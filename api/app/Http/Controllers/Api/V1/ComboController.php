<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Combo;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ComboController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $combos = Combo::with(['comboItems.item', 'comboItems.variant', 'modifierGroups.modifiers'])
            ->when($request->filled('is_active'), fn ($q) => $q->where('is_active', $request->boolean('is_active')))
            ->orderBy('sort_order')
            ->get();

        return response()->json(['data' => $combos]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:200',
            'description' => 'nullable|string',
            'price' => 'required|numeric|min:0',
            'cgst' => 'numeric|min:0',
            'sgst' => 'numeric|min:0',
            'igst' => 'numeric|min:0',
            'sort_order' => 'integer|min:0',
            'is_active' => 'boolean',
            'items' => 'nullable|array',
            'items.*.item_id' => 'required|uuid|exists:items,id',
            'items.*.item_variant_id' => 'nullable|uuid|exists:item_variants,id',
            'items.*.quantity' => 'integer|min:1',
            'items.*.sort_order' => 'integer|min:0',
            'modifier_group_ids' => 'nullable|array',
            'modifier_group_ids.*' => 'uuid|exists:modifier_groups,id',
        ]);

        $combo = Combo::create(array_merge(
            $validated,
            ['company_id' => $request->user()->company_id]
        ));

        foreach ($validated['items'] ?? [] as $ci) {
            $combo->comboItems()->create($ci);
        }

        if (! empty($validated['modifier_group_ids'])) {
            $combo->modifierGroups()->sync($validated['modifier_group_ids']);
        }

        return response()->json(['data' => $combo->load('comboItems.item', 'comboItems.variant', 'modifierGroups.modifiers')], 201);
    }

    public function show(Combo $combo): JsonResponse
    {
        return response()->json(['data' => $combo->load('comboItems.item', 'comboItems.variant', 'modifierGroups.modifiers')]);
    }

    public function update(Request $request, Combo $combo): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'sometimes|string|max:200',
            'description' => 'nullable|string',
            'price' => 'sometimes|numeric|min:0',
            'cgst' => 'numeric|min:0',
            'sgst' => 'numeric|min:0',
            'igst' => 'numeric|min:0',
            'sort_order' => 'integer|min:0',
            'is_active' => 'boolean',
            'items' => 'nullable|array',
            'items.*.item_id' => 'required|uuid|exists:items,id',
            'items.*.item_variant_id' => 'nullable|uuid|exists:item_variants,id',
            'items.*.quantity' => 'integer|min:1',
            'items.*.sort_order' => 'integer|min:0',
            'modifier_group_ids' => 'nullable|array',
            'modifier_group_ids.*' => 'uuid|exists:modifier_groups,id',
        ]);

        $combo->update($validated);

        if ($request->has('items')) {
            $combo->comboItems()->delete();
            foreach ($validated['items'] ?? [] as $ci) {
                $combo->comboItems()->create($ci);
            }
        }

        if ($request->has('modifier_group_ids')) {
            $combo->modifierGroups()->sync($validated['modifier_group_ids']);
        }

        return response()->json(['data' => $combo->load('comboItems.item', 'comboItems.variant', 'modifierGroups.modifiers')]);
    }

    public function destroy(Combo $combo): JsonResponse
    {
        $combo->delete();

        return response()->json(['message' => 'Combo deleted']);
    }
}
