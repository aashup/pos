<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Party;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PartyController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Party::class);

        $parties = Party::query()
            ->when($request->type, fn ($q, $t) => $q->where('type', $t)->orWhere('type', 'both'))
            ->when($request->search, fn ($q, $s) => $q->where('name', 'like', "%{$s}%")->orWhere('gstin', 'like', "%{$s}%"))
            ->when($request->boolean('active_only'), fn ($q) => $q->where('is_active', true));

        // Sorting
        if ($request->sort_by) {
            $sortOrder = $request->sort_order === 'desc' ? 'desc' : 'asc';

            match ($request->sort_by) {
                'name' => $parties->orderBy('name', $sortOrder),
                'type' => $parties->orderBy('type', $sortOrder),
                'gstin' => $parties->orderBy('gstin', $sortOrder),
                'city' => $parties->orderBy('city', $sortOrder),
                'phone' => $parties->orderBy('phone', $sortOrder),
                'credit_limit' => $parties->orderBy('credit_limit', $sortOrder),
                default => $parties->orderBy('name'),
            };
        } else {
            $parties->orderBy('name');
        }

        $parties = $parties->paginate($request->per_page ?? 25);

        return response()->json($parties);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorize('create', Party::class);

        $validated = $request->validate([
            'type' => 'required|in:customer,vendor,both',
            'name' => 'required|string|max:255',
            'gstin' => 'nullable|string|size:15',
            'pan' => 'nullable|string|size:10',
            'address' => 'nullable|string',
            'city' => 'nullable|string|max:100',
            'state' => 'nullable|string|max:100',
            'state_code' => 'nullable|string|size:2',
            'pincode' => 'nullable|string|max:6',
            'phone' => 'nullable|string|max:15',
            'email' => 'nullable|email',
            'contact_person' => 'nullable|string|max:255',
            'credit_limit' => 'nullable|numeric|min:0',
            'opening_balance' => 'nullable|numeric',
            'balance_type' => 'nullable|in:dr,cr',
        ]);

        $party = Party::create($validated);

        return response()->json(['data' => $party], 201);
    }

    public function show(Party $party): JsonResponse
    {
        $this->authorize('view', $party);

        return response()->json(['data' => $party]);
    }

    public function update(Request $request, Party $party): JsonResponse
    {
        $this->authorize('update', $party);

        $validated = $request->validate([
            'type' => 'sometimes|in:customer,vendor,both',
            'name' => 'sometimes|string|max:255',
            'gstin' => 'nullable|string|size:15',
            'pan' => 'nullable|string|size:10',
            'address' => 'nullable|string',
            'city' => 'nullable|string|max:100',
            'state' => 'nullable|string|max:100',
            'state_code' => 'nullable|string|size:2',
            'pincode' => 'nullable|string|max:6',
            'phone' => 'nullable|string|max:15',
            'email' => 'nullable|email',
            'contact_person' => 'nullable|string|max:255',
            'credit_limit' => 'nullable|numeric|min:0',
            'is_active' => 'boolean',
        ]);

        $party->update($validated);

        return response()->json(['data' => $party]);
    }

    public function destroy(Party $party): JsonResponse
    {
        $this->authorize('delete', $party);

        $party->delete();

        return response()->json(['message' => 'Party deleted']);
    }

    /**
     * Return the real-time ledger balance for a party.
     * Balance = opening_balance (sign-adjusted) + sum of all posted voucher debit/credit lines.
     * Positive = Dr (customer owes us); Negative = Cr (we owe customer).
     */
    public function balance(Party $party): JsonResponse
    {
        $this->authorize('view', $party);

        $companyId = auth()->user()->company_id;

        // Collect the party's linked ledger IDs (debtor and/or creditor)
        $ledgerIds = array_filter([
            $party->debtor_ledger_id,
            $party->creditor_ledger_id,
        ]);

        // Opening balance — sign convention: Dr positive, Cr negative
        $openingBalance = (float) ($party->opening_balance ?? 0);
        if ($party->balance_type === 'cr') {
            $openingBalance = -$openingBalance;
        }

        $runningBalance = $openingBalance;

        if (! empty($ledgerIds)) {
            $totals = DB::table('voucher_lines')
                ->join('vouchers', 'voucher_lines.voucher_id', '=', 'vouchers.id')
                ->where('vouchers.company_id', $companyId)
                ->where('vouchers.is_posted', true)
                ->whereIn('voucher_lines.ledger_id', $ledgerIds)
                ->selectRaw('SUM(voucher_lines.debit) as total_debit, SUM(voucher_lines.credit) as total_credit')
                ->first();

            $runningBalance += ((float) ($totals->total_debit ?? 0)) - ((float) ($totals->total_credit ?? 0));
        }

        $balance = round($runningBalance, 2);
        $balanceAbs = abs($balance);
        $type = $balance >= 0 ? 'dr' : 'cr';

        return response()->json([
            'data' => [
                'balance' => $balance,
                'balance_abs' => $balanceAbs,
                'type' => $type,         // 'dr' = owes us, 'cr' = we owe them
            ],
        ]);
    }
}
