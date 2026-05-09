<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\CompanySetting;
use App\Models\Employee;
use App\Models\Ledger;
use App\Models\Voucher;
use App\Services\AccountingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class EmployeeController extends Controller
{
    public function __construct(private AccountingService $accountingService) {}
    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Employee::class);

        $employees = Employee::query()
            ->with(['department', 'designation', 'salaryStructure'])
            ->when($request->search, fn ($q, $s) => $q->where('name', 'like', "%{$s}%")
                ->orWhere('employee_code', 'like', "%{$s}%"))
            ->when($request->department_id, fn ($q, $d) => $q->where('department_id', $d))
            ->when($request->designation_id, fn ($q, $d) => $q->where('designation_id', $d))
            ->when($request->joining_date_from, fn ($q, $d) => $q->whereDate('joining_date', '>=', $d))
            ->when($request->joining_date_to, fn ($q, $d) => $q->whereDate('joining_date', '<=', $d))
            ->when($request->boolean('active_only'), fn ($q) => $q->where('is_active', true))
            ->when($request->is_active !== null && $request->is_active !== '',
                fn ($q) => $q->where('is_active', $request->is_active === '1'));

        if ($request->sort_by) {
            $sortOrder = $request->sort_order === 'desc' ? 'desc' : 'asc';
            match ($request->sort_by) {
                'name' => $employees->orderBy('name', $sortOrder),
                'employee_code' => $employees->orderBy('employee_code', $sortOrder),
                'joining_date' => $employees->orderBy('joining_date', $sortOrder),
                default => $employees->orderBy('name'),
            };
        } else {
            $employees->orderBy('name');
        }

        return response()->json($employees->paginate($request->per_page ?? 25));
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorize('create', Employee::class);

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'gender' => 'nullable|in:male,female,other',
            'date_of_birth' => 'nullable|date',
            'phone' => 'nullable|string|max:20',
            'email' => 'nullable|email',
            'address' => 'nullable|string',
            'city' => 'nullable|string|max:100',
            'state' => 'nullable|string|max:100',
            'department_id' => 'nullable|exists:departments,id',
            'designation_id' => 'nullable|exists:designations,id',
            'joining_date' => 'required|date',
            'employment_type' => 'nullable|in:permanent,contract,part_time',
            'bank_account_name' => 'nullable|string|max:255',
            'bank_account_no' => 'nullable|string|max:30',
            'bank_ifsc' => 'nullable|string|max:15',
            'bank_name' => 'nullable|string|max:255',
            'pan' => 'nullable|string|max:10',
            'pf_number' => 'nullable|string|max:30',
            'esi_number' => 'nullable|string|max:30',
            'is_pf_applicable' => 'boolean',
            'is_esi_applicable' => 'boolean',
        ]);

        $companyId = $request->user()->company_id;

        $employee = DB::transaction(function () use ($validated, $companyId) {
            $setting = CompanySetting::lockForUpdate()
                ->where('company_id', $companyId)
                ->where('key', 'employee_next_number')
                ->first();

            $nextNumber = $setting ? (int) $setting->value : 1;

            CompanySetting::updateOrCreate(
                ['company_id' => $companyId, 'key' => 'employee_next_number'],
                ['value' => (string) ($nextNumber + 1)]
            );

            $validated['employee_code'] = 'EMP-'.str_pad($nextNumber, 5, '0', STR_PAD_LEFT);

            return Employee::create($validated);
        });

        return response()->json(['data' => $employee->load(['department', 'designation'])], 201);
    }

    public function show(Employee $employee): JsonResponse
    {
        $this->authorize('view', $employee);

        return response()->json(['data' => $employee->load(['department', 'designation', 'salaryStructure'])]);
    }

    public function update(Request $request, Employee $employee): JsonResponse
    {
        $this->authorize('update', $employee);

        $validated = $request->validate([
            'employee_code' => 'nullable|string|max:50',
            'name' => 'sometimes|string|max:255',
            'gender' => 'nullable|in:male,female,other',
            'date_of_birth' => 'nullable|date',
            'phone' => 'nullable|string|max:20',
            'email' => 'nullable|email',
            'address' => 'nullable|string',
            'city' => 'nullable|string|max:100',
            'state' => 'nullable|string|max:100',
            'department_id' => 'nullable|exists:departments,id',
            'designation_id' => 'nullable|exists:designations,id',
            'joining_date' => 'sometimes|date',
            'employment_type' => 'nullable|in:permanent,contract,part_time',
            'bank_account_name' => 'nullable|string|max:255',
            'bank_account_no' => 'nullable|string|max:30',
            'bank_ifsc' => 'nullable|string|max:15',
            'bank_name' => 'nullable|string|max:255',
            'pan' => 'nullable|string|max:10',
            'pf_number' => 'nullable|string|max:30',
            'esi_number' => 'nullable|string|max:30',
            'is_pf_applicable' => 'boolean',
            'is_esi_applicable' => 'boolean',
            'is_active' => 'boolean',
        ]);

        $employee->update($validated);

        return response()->json(['data' => $employee->load(['department', 'designation'])]);
    }

    public function destroy(Employee $employee): JsonResponse
    {
        $this->authorize('delete', $employee);

        $employee->delete();

        return response()->json(['message' => 'Employee deleted']);
    }

    public function salaryStructure(Employee $employee): JsonResponse
    {
        $this->authorize('view', $employee);

        $structure = $employee->salaryStructure;

        return response()->json(['data' => $structure]);
    }

    public function payAdvance(Request $request, Employee $employee): JsonResponse
    {
        $this->authorize('update', $employee);

        $companyId = auth()->user()->company_id;

        $validated = $request->validate([
            'payment_ledger_id' => 'required|string|exists:ledgers,id',
            'amount'            => 'required|numeric|min:0.01',
            'advance_date'      => 'required|date',
            'description'       => 'nullable|string|max:500',
        ]);

        $paymentLedger = Ledger::where('id', $validated['payment_ledger_id'])
            ->where('company_id', $companyId)
            ->firstOrFail();

        $voucher = $this->accountingService->postAdvancePayment(
            $employee,
            $paymentLedger,
            (float) $validated['amount'],
            $validated['advance_date'],
            $validated['description'] ?? null,
            auth()->id()
        );

        if (! $voucher) {
            return response()->json(['message' => 'Failed to post advance voucher. Ensure default account groups are loaded.'], 500);
        }

        return response()->json(['data' => $voucher->load('lines.ledger')], 201);
    }

    public function advanceBalance(Employee $employee): JsonResponse
    {
        $this->authorize('view', $employee);

        $companyId = auth()->user()->company_id;

        $advanceLedger = Ledger::where('company_id', $companyId)
            ->where('system_key', 'employee_advances_account')
            ->first();

        if (! $advanceLedger) {
            return response()->json(['outstanding' => 0, 'vouchers' => []]);
        }

        $vouchers = Voucher::where('company_id', $companyId)
            // ->where('reference_type', Employee::class)
            ->where('reference_id', $employee->id)
            // ->where('source', 'advance')
            ->with(['lines' => fn ($q) => $q->where('ledger_id', $advanceLedger->id)])
            ->orderByDesc('voucher_date')
            ->orderByDesc('created_at')
            ->limit(50)
            ->get();

        $outstanding = $vouchers->sum(function ($v) {
            return $v->lines->sum(fn ($l) => (float) $l->debit - (float) $l->credit);
        });

        return response()->json([
            'outstanding' => round($outstanding, 2),
            'vouchers'    => $vouchers->map(fn ($v) => [
                'id'             => $v->id,
                'voucher_number' => $v->voucher_number,
                'voucher_date'   => $v->voucher_date,
                'narration'      => $v->narration,
                'amount'         => $v->lines->sum(fn ($l) => (float) $l->debit),
            ]),
        ]);
    }
}
