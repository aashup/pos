<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Item;
use App\Models\Unit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ItemController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Item::class);

        $items = Item::with(['batches', 'itemGroup', 'alternateUnits'])
            ->when($request->search, fn ($q, $s) => $q->where('name', 'like', "%{$s}%")->orWhere('sku', 'like', "%{$s}%"))
            ->when($request->sku, fn ($q, $s) => $q->where('sku', 'like', "%{$s}%"))
            ->when($request->item_group_id, fn ($q, $g) => $q->where('item_group_id', $g))
            ->when($request->filled('is_active'), fn ($q) => $q->where('is_active', $request->boolean('is_active')))
            ->when($request->unit, fn ($q, $u) => $q->where('unit', $u));

        // Sorting
        if ($request->sort_by) {
            $sortOrder = $request->sort_order === 'desc' ? 'desc' : 'asc';

            match ($request->sort_by) {
                'name' => $items->orderBy('name', $sortOrder),
                'sku' => $items->orderBy('sku', $sortOrder),
                'hsn_code' => $items->orderBy('hsn_code', $sortOrder),
                'unit' => $items->orderBy('unit', $sortOrder),
                'group_name' => $items->join('item_groups', 'items.item_group_id', '=', 'item_groups.id')->orderBy('item_groups.name', $sortOrder),
                'igst' => $items->orderBy('igst', $sortOrder),
                'sgst' => $items->orderBy('sgst', $sortOrder),
                'cgst' => $items->orderBy('cgst', $sortOrder),
                'selling_price' => $items->orderBy('selling_price', $sortOrder),
                'is_active' => $items->orderBy('is_active', $sortOrder),
                default => $items->orderBy('name'),
            };
        } else {
            $items->orderBy('name');
        }

        $paginated = $items->paginate($request->per_page ?? 25);

        return response()->json($paginated);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorize('create', Item::class);

        $activeUnitValues = Unit::where('company_id', $request->user()->company_id)
            ->where('status', 'active')
            ->pluck('value')
            ->toArray();

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'sku' => 'nullable|string|max:100',
            'hsn_code' => 'nullable|string|max:10',
            'unit' => ['required', 'string', 'max:20', Rule::in($activeUnitValues)],
            'item_group_id' => 'nullable|uuid|exists:item_groups,id',
            'igst' => 'required|numeric|min:0',
            'sgst' => 'required|numeric|min:0',
            'cgst' => 'required|numeric|min:0',
            'mrp' => 'nullable|numeric|min:0',
            'purchase_price' => 'nullable|numeric|min:0',
            'selling_price' => 'nullable|numeric|min:0',
            'reorder_level' => 'nullable|integer|min:0',
            'is_batch_tracked' => 'boolean',
            'alternate_units' => 'nullable|array',
            'alternate_units.*.unit' => ['required', 'string', 'max:20', Rule::in($activeUnitValues)],
            'alternate_units.*.conversion_factor' => 'required|numeric|min:0.0001',
            'alternate_units.*.selling_price' => 'nullable|numeric|min:0',
            'alternate_units.*.is_default_purchase' => 'boolean',
            'alternate_units.*.is_default_sale' => 'boolean',
        ]);

        $item = Item::create($validated);

        foreach ($validated['alternate_units'] ?? [] as $au) {
            if ($au['unit'] === $validated['unit']) {
                continue; // skip if same as base unit
            }
            $item->alternateUnits()->create([
                'unit' => $au['unit'],
                'conversion_factor' => $au['conversion_factor'],
                'selling_price' => $au['selling_price'] ?? null,
                'is_default_purchase' => $au['is_default_purchase'] ?? false,
                'is_default_sale' => $au['is_default_sale'] ?? false,
            ]);
        }

        return response()->json(['data' => $item->load('alternateUnits')], 201);
    }

    public function show(Item $item): JsonResponse
    {
        $this->authorize('view', $item);

        return response()->json(['data' => $item->load('batches', 'alternateUnits')]);
    }

    public function update(Request $request, Item $item): JsonResponse
    {
        $this->authorize('update', $item);

        $activeUnitValues = Unit::where('company_id', $request->user()->company_id)
            ->where('status', 'active')
            ->pluck('value')
            ->toArray();

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'sku' => 'nullable|string|max:100',
            'hsn_code' => 'nullable|string|max:10',
            'unit' => ['sometimes', 'string', 'max:20', Rule::in($activeUnitValues)],
            'item_group_id' => 'nullable|uuid|exists:item_groups,id',
            'igst' => 'sometimes|numeric|min:0',
            'sgst' => 'sometimes|numeric|min:0',
            'cgst' => 'sometimes|numeric|min:0',
            'mrp' => 'nullable|numeric|min:0',
            'purchase_price' => 'nullable|numeric|min:0',
            'selling_price' => 'nullable|numeric|min:0',
            'reorder_level' => 'nullable|integer|min:0',
            'is_batch_tracked' => 'boolean',
            'is_active' => 'boolean',
            'alternate_units' => 'nullable|array',
            'alternate_units.*.unit' => ['required', 'string', 'max:20', Rule::in($activeUnitValues)],
            'alternate_units.*.conversion_factor' => 'required|numeric|min:0.0001',
            'alternate_units.*.selling_price' => 'nullable|numeric|min:0',
            'alternate_units.*.is_default_purchase' => 'boolean',
            'alternate_units.*.is_default_sale' => 'boolean',
        ]);

        $item->update($validated);

        if ($request->has('alternate_units')) {
            $baseUnit = $item->unit;
            $incomingUnits = collect($validated['alternate_units'] ?? [])
                ->filter(fn ($au) => $au['unit'] !== $baseUnit)
                ->keyBy('unit');

            // Soft-delete removed alternate units
            $item->alternateUnits()
                ->whereNotIn('unit', $incomingUnits->keys()->toArray())
                ->delete();

            // Upsert kept/new alternate units
            foreach ($incomingUnits as $unitValue => $au) {
                $item->alternateUnits()->withTrashed()->updateOrCreate(
                    ['unit' => $unitValue],
                    [
                        'conversion_factor' => $au['conversion_factor'],
                        'selling_price' => $au['selling_price'] ?? null,
                        'is_default_purchase' => $au['is_default_purchase'] ?? false,
                        'is_default_sale' => $au['is_default_sale'] ?? false,
                        'deleted_at' => null,
                    ]
                );
            }
        }

        return response()->json(['data' => $item->load('alternateUnits')]);
    }

    public function destroy(Item $item): JsonResponse
    {
        $this->authorize('delete', $item);

        $item->delete();

        return response()->json(['message' => 'Item deleted']);
    }
}
