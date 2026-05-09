<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Employee;
use App\Models\Ledger;
use App\Models\PayrollEntry;
use App\Models\PayrollRun;
use App\Services\AccountingService;
use App\Services\PayrollService;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;

class PayrollController extends Controller
{
    public function __construct(
        private PayrollService $payrollService,
        private AccountingService $accountingService,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', PayrollRun::class);

        $runs = PayrollRun::query()
            ->when($request->status, fn ($q, $s) => $q->where('status', $s))
            ->orderByDesc('year')
            ->orderByDesc('month')
            ->paginate($request->per_page ?? 25);

        return response()->json($runs);
    }

    public function generate(Request $request): JsonResponse
    {
        $this->authorize('create', PayrollRun::class);

        $validated = $request->validate([
            'month' => 'required|integer|min:1|max:12',
            'year' => 'required|integer|min:2000|max:2100',
            'working_days' => 'nullable|integer|min:1|max:31',
            'notes' => 'nullable|string',
        ]);

        $companyId = auth()->user()->company_id;
        $month = (int) $validated['month'];
        $year = (int) $validated['year'];
        $workingDays = (int) ($validated['working_days'] ?? 26);

        // Prevent duplicate run
        $existing = PayrollRun::where('company_id', $companyId)
            ->where('month', $month)
            ->where('year', $year)
            ->withTrashed()
            ->first();

        if ($existing) {
            return response()->json(['message' => 'Payroll run already exists for this month/year.'], 422);
        }

        $run = $this->payrollService->generate($companyId, $month, $year, $workingDays);

        if (isset($validated['notes'])) {
            $run->update(['notes' => $validated['notes']]);
        }

        return response()->json(['data' => $run->load('entries.employee')], 201);
    }

    public function show(PayrollRun $payrollRun): JsonResponse
    {
        $this->authorize('view', $payrollRun);

        $payrollRun->load(['entries.employee.department', 'entries.employee.designation', 'entries.paymentVoucher', 'voucher']);

        return response()->json(['data' => $payrollRun]);
    }

    public function updateEntry(Request $request, PayrollRun $payrollRun, PayrollEntry $entry): JsonResponse
    {
        $this->authorize('update', $payrollRun);

        if ($payrollRun->status !== 'draft') {
            return response()->json(['message' => 'Only draft runs can be edited.'], 422);
        }

        $validated = $request->validate([
            'present_days' => 'required|integer|min:0|max:31',
        ]);

        $entry->update(['present_days' => $validated['present_days']]);
        $this->payrollService->recomputeEntry($entry);

        $payrollRun->refresh();

        return response()->json(['data' => $payrollRun->load(['entries.employee'])]);
    }

    public function approve(Request $request, PayrollRun $payrollRun): JsonResponse
    {
        $this->authorize('update', $payrollRun);

        if ($payrollRun->status !== 'draft') {
            return response()->json(['message' => 'Only draft runs can be approved.'], 422);
        }

        $userId = auth()->id();

        $voucher = $this->accountingService->postPayroll($payrollRun, $userId);

        $payrollRun->update([
            'status' => 'approved',
            'approved_at' => now(),
            'approved_by' => $userId,
            'voucher_id' => $voucher?->id,
        ]);

        return response()->json(['data' => $payrollRun->fresh(['voucher'])]);
    }

    public function markPaid(Request $request, PayrollRun $payrollRun): JsonResponse
    {
        $this->authorize('update', $payrollRun);

        if ($payrollRun->status !== 'approved') {
            return response()->json(['message' => 'Only approved runs can be marked as paid.'], 422);
        }

        $companyId = auth()->user()->company_id;

        $validated = $request->validate([
            'entry_ids'          => 'required|array|min:1',
            'entry_ids.*'        => 'required|string|exists:payroll_entries,id',
            'payment_ledger_id'  => 'required|string|exists:ledgers,id',
        ]);

        $paymentLedger = Ledger::where('id', $validated['payment_ledger_id'])
            ->where('company_id', $companyId)
            ->firstOrFail();

        $entries = PayrollEntry::whereIn('id', $validated['entry_ids'])
            ->where('payroll_run_id', $payrollRun->id)
            ->where('is_paid', false)
            ->with('employee')
            ->get();

        if ($entries->isEmpty()) {
            return response()->json(['message' => 'No unpaid entries found for the given IDs.'], 422);
        }

        $voucher = $this->accountingService->postPayrollPayment(
            $payrollRun,
            $entries->all(),
            $paymentLedger,
            auth()->id()
        );

        if (! $voucher) {
            return response()->json(['message' => 'Failed to post payment voucher.'], 500);
        }

        DB::transaction(function () use ($entries, $voucher, $payrollRun) {
            PayrollEntry::whereIn('id', $entries->pluck('id'))
                ->update(['is_paid' => true, 'payment_voucher_id' => $voucher->id]);

            $unpaidCount = PayrollEntry::where('payroll_run_id', $payrollRun->id)
                ->where('is_paid', false)
                ->count();

            if ($unpaidCount === 0) {
                $payrollRun->update(['status' => 'paid']);
            }
        });

        return response()->json([
            'data'       => $payrollRun->fresh(['entries.employee', 'entries.paymentVoucher']),
            'voucher'    => $voucher,
            'paid_count' => $entries->count(),
        ]);
    }

    public function destroy(PayrollRun $payrollRun): JsonResponse
    {
        $this->authorize('delete', $payrollRun);

        if ($payrollRun->status !== 'draft') {
            return response()->json(['message' => 'Only draft runs can be deleted.'], 422);
        }

        $payrollRun->delete();

        return response()->json(['message' => 'Payroll run deleted']);
    }

    public function payslip(PayrollRun $payrollRun, Employee $employee): Response
    {
        $this->authorize('view', $payrollRun);

        $entry = PayrollEntry::where('payroll_run_id', $payrollRun->id)
            ->where('employee_id', $employee->id)
            ->firstOrFail();

        $employee->load(['department', 'designation']);
        $company = auth()->user()->company;

        $data = [
            'company' => $company,
            'employee' => $employee,
            'run' => $payrollRun,
            'entry' => $entry,
            'period' => date('F Y', mktime(0, 0, 0, $payrollRun->month, 1, $payrollRun->year)),
        ];

        $pdf = Pdf::loadView('payroll.payslip', $data)
            ->setPaper([0, 0, 595.28, 841.89], 'portrait');

        $filename = "Payslip-{$employee->name}-{$payrollRun->year}-{$payrollRun->month}.pdf";

        return $pdf->download($filename);
    }
}
