<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\CompanySetting;
use App\Models\Voucher;
use App\Traits\FiltersByFinancialYear;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class VoucherController extends Controller
{
    use FiltersByFinancialYear;

    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Voucher::class);

        $query = Voucher::with('lines.ledger.group')
            ->when($request->voucher_type, fn ($q, $t) => $q->where('voucher_type', $t))
            ->when($request->search, fn ($q, $s) => $q->where('voucher_number', 'like', "%{$s}%"))
            ->when($request->date_from, fn ($q, $d) => $q->where('vouchers.voucher_date', '>=', $d))
            ->when($request->date_to, fn ($q, $d) => $q->where('vouchers.voucher_date', '<=', $d));

        // Sorting
        if ($request->sort_by) {
            $sortOrder = $request->sort_order === 'asc' ? 'asc' : 'desc';

            match ($request->sort_by) {
                'voucher_number' => $query->orderBy('vouchers.voucher_number', $sortOrder),
                'voucher_date' => $query->orderBy('vouchers.voucher_date', $sortOrder),
                'voucher_type' => $query->orderBy('vouchers.voucher_type', $sortOrder),
                'narration' => $query->orderBy('vouchers.narration', $sortOrder),
                'is_posted' => $query->orderBy('vouchers.is_posted', $sortOrder),
                default => $query->latest('vouchers.voucher_date'),
            };
        } else {
            $query->latest('vouchers.voucher_date');
        }

        $this->applyFYFilter($query, $request, 'vouchers.voucher_date');

        $entries = $query->paginate($request->per_page ?? 25);

        return response()->json($entries);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorize('create', Voucher::class);

        $validated = $request->validate([
            'financial_year_id' => 'required|uuid|exists:financial_years,id',
            'voucher_number' => 'nullable|string|unique:vouchers',
            'voucher_date' => 'required|date',
            'voucher_type' => 'required|in:purchase,sales,payment,receipt,journal,contra',
            'narration' => 'nullable|string',
            'lines' => 'required|array|min:2',
            'lines.*.ledger_id' => 'required|uuid|exists:ledgers,id',
            'lines.*.debit' => 'required|numeric|min:0',
            'lines.*.credit' => 'required|numeric|min:0',
            'lines.*.narration' => 'nullable|string',
        ]);

        // Validate debit = credit
        $totalDebit = collect($validated['lines'])->sum('debit');
        $totalCredit = collect($validated['lines'])->sum('credit');

        if (round($totalDebit, 2) !== round($totalCredit, 2)) {
            return response()->json(['message' => 'Total debit must equal total credit'], 422);
        }

        // Auto-generate voucher number if not provided
        if (empty($validated['voucher_number'])) {
            $nextNumber = CompanySetting::getAndIncrementVoucherIndex(
                $request->user()->company_id,
                $validated['voucher_type']
            );
            $prefix = Voucher::getTypePrefix($validated['voucher_type']);
            $validated['voucher_number'] = $prefix.'-'.str_pad($nextNumber, 5, '0', STR_PAD_LEFT);
        }

        $entry = DB::transaction(function () use ($validated, $request) {
            $entry = Voucher::create([
                ...$validated,
                'source' => 'manual',
                'is_posted' => true,
                'created_by' => $request->user()->id,
            ]);

            foreach ($validated['lines'] as $line) {
                $entry->lines()->create($line);
            }

            return $entry->load('lines.ledger.group');
        });

        return response()->json(['data' => $entry], 201);
    }

    public function show(Voucher $voucher): JsonResponse
    {
        $this->authorize('view', $voucher);

        return response()->json(['data' => $voucher->load('lines.ledger.group', 'financialYear')]);
    }

    public function destroy(Voucher $voucher): JsonResponse
    {
        $this->authorize('delete', $voucher);

        return response()->json(['message' => 'Vouchers are append-only. Create a reversal entry instead.'], 422);
    }
}
