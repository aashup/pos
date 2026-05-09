<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Item;
use App\Models\ItemVariant;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ItemVariantController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $variants = ItemVariant::query()
            ->when($request->item_id, fn ($q, $id) => $q->where('item_id', $id))
            ->when($request->filled('is_active'), fn ($q) => $q->where('is_active', $request->boolean('is_active')))
            ->orderBy('item_id')
            ->orderBy('sort_order')
            ->get();

        return response()->json(['data' => $variants]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'item_id' => 'required|uuid|exists:items,id',
            'name' => 'required|string|max:100',
            'price_override' => 'nullable|numeric|min:0',
            'sku' => 'nullable|string|max:100',
            'sort_order' => 'integer|min:0',
            'is_active' => 'boolean',
        ]);

        $variant = ItemVariant::create($validated);

        return response()->json(['data' => $variant], 201);
    }

    public function show(ItemVariant $itemVariant): JsonResponse
    {
        return response()->json(['data' => $itemVariant]);
    }

    public function update(Request $request, ItemVariant $itemVariant): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'sometimes|string|max:100',
            'price_override' => 'nullable|numeric|min:0',
            'sku' => 'nullable|string|max:100',
            'sort_order' => 'integer|min:0',
            'is_active' => 'boolean',
        ]);

        $itemVariant->update($validated);

        return response()->json(['data' => $itemVariant]);
    }

    public function destroy(ItemVariant $itemVariant): JsonResponse
    {
        $itemVariant->delete();

        return response()->json(['message' => 'Variant deleted']);
    }
}
