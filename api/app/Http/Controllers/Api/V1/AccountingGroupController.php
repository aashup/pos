<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\AccountingGroup;
use App\Models\CompanySetting;
use App\Services\DefaultGroupsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AccountingGroupController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', AccountingGroup::class);

        $accounts = AccountingGroup::with(['children', 'ledgers'])
            ->when($request->type, fn ($q, $t) => $q->where('type', $t))
            ->when($request->boolean('root_only'), fn ($q) => $q->whereNull('parent_id'))
            ->when($request->boolean('active_only'), fn ($q) => $q->where('is_active', true))
            ->orderBy('code')
            ->paginate($request->per_page ?? 100);

        return response()->json($accounts);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorize('create', AccountingGroup::class);

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'code' => 'required|string|max:20',
            'type' => 'required|in:asset,liability,equity,income,expense',
            'parent_id' => 'nullable|uuid|exists:accounting_groups,id',
            'balance_type' => 'nullable|in:dr,cr',
        ]);

        $group = AccountingGroup::create([
            ...$validated,
            'company_id' => $request->user()->company_id,
            'is_system' => false,
            'is_active' => true,
        ]);

        return response()->json(['data' => $group->load('parent', 'children')], 201);
    }

    public function show(AccountingGroup $accountingGroup): JsonResponse
    {
        $this->authorize('view', $accountingGroup);

        return response()->json(['data' => $accountingGroup->load('children', 'parent')]);
    }

    public function update(Request $request, AccountingGroup $accountingGroup): JsonResponse
    {
        $this->authorize('update', $accountingGroup);

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'is_active' => 'boolean',
            'balance_type' => 'nullable|in:dr,cr',
        ]);

        $accountingGroup->update($validated);

        return response()->json(['data' => $accountingGroup]);
    }

    public function destroy(AccountingGroup $accountingGroup): JsonResponse
    {
        $this->authorize('delete', $accountingGroup);

        $accountingGroup->delete();

        return response()->json(['message' => 'Account deleted']);
    }

    /**
     * Load default account groups (Tally) — one-time operation.
     * After registration this is already done automatically; this endpoint
     * is kept for manual re-trigger from Settings if ever needed.
     */
    public function loadDefaults(Request $request): JsonResponse
    {
        $companyId = $request->user()->company_id;

        $loaded = CompanySetting::getValue($companyId, 'default_groups_loaded');
        if ($loaded) {
            return response()->json([
                'message' => "Default groups already loaded ({$loaded}).",
            ], 422);
        }

        (new DefaultGroupsService)->load($companyId);

        $accounts = AccountingGroup::where('company_id', $companyId)
            ->where('is_system', true)
            ->with('children')
            ->whereNull('parent_id')
            ->orderBy('code')
            ->get();

        return response()->json([
            'message' => 'Tally default groups loaded successfully.',
            'loaded_preset' => 'tally',
            'data' => $accounts,
        ]);
    }
}
