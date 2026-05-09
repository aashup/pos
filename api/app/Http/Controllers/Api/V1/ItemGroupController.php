<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\ItemGroup;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ItemGroupController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', ItemGroup::class);

        $groups = ItemGroup::with('children')
            ->when($request->search, fn ($q, $s) => $q->where('name', 'like', "%{$s}%"))
            ->when($request->boolean('root_only'), fn ($q) => $q->whereNull('parent_id'))
            ->when($request->boolean('active_only'), fn ($q) => $q->where('is_active', true))
            ->orderBy('name')
            ->paginate($request->per_page ?? 100);

        return response()->json($groups);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorize('create', ItemGroup::class);

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'parent_id' => 'nullable|uuid|exists:item_groups,id',
        ]);

        $group = ItemGroup::create([
            ...$validated,
            'company_id' => $request->user()->company_id,
            'is_active' => true,
        ]);

        return response()->json(['data' => $group->load('parent', 'children')], 201);
    }

    public function show(ItemGroup $itemGroup): JsonResponse
    {
        $this->authorize('view', $itemGroup);

        return response()->json(['data' => $itemGroup->load('children', 'parent')]);
    }

    public function update(Request $request, ItemGroup $itemGroup): JsonResponse
    {
        $this->authorize('update', $itemGroup);

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'parent_id' => 'nullable|uuid|exists:item_groups,id',
            'is_active' => 'boolean',
        ]);

        $itemGroup->update($validated);

        return response()->json(['data' => $itemGroup->load('parent', 'children')]);
    }

    public function destroy(ItemGroup $itemGroup): JsonResponse
    {
        $this->authorize('delete', $itemGroup);

        $itemGroup->delete();

        return response()->json(['message' => 'Item group deleted']);
    }
}
