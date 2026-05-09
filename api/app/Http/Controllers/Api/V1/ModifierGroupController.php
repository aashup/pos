<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\ModifierGroup;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ModifierGroupController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $groups = ModifierGroup::with('modifiers')
            ->when($request->filled('is_active'), fn ($q) => $q->where('is_active', $request->boolean('is_active')))
            ->orderBy('sort_order')
            ->get();

        return response()->json(['data' => $groups]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:100',
            'is_required' => 'boolean',
            'min_selections' => 'integer|min:0',
            'max_selections' => 'integer|min:1',
            'sort_order' => 'integer|min:0',
            'is_active' => 'boolean',
            'modifiers' => 'nullable|array',
            'modifiers.*.name' => 'required|string|max:100',
            'modifiers.*.price' => 'numeric|min:0',
            'modifiers.*.sort_order' => 'integer|min:0',
        ]);

        $group = ModifierGroup::create(array_merge(
            $validated,
            ['company_id' => $request->user()->company_id]
        ));

        foreach ($validated['modifiers'] ?? [] as $mod) {
            $group->modifiers()->create($mod);
        }

        return response()->json(['data' => $group->load('modifiers')], 201);
    }

    public function show(ModifierGroup $modifierGroup): JsonResponse
    {
        return response()->json(['data' => $modifierGroup->load('modifiers')]);
    }

    public function update(Request $request, ModifierGroup $modifierGroup): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'sometimes|string|max:100',
            'is_required' => 'boolean',
            'min_selections' => 'integer|min:0',
            'max_selections' => 'integer|min:1',
            'sort_order' => 'integer|min:0',
            'is_active' => 'boolean',
        ]);

        $modifierGroup->update($validated);

        return response()->json(['data' => $modifierGroup->load('modifiers')]);
    }

    public function destroy(ModifierGroup $modifierGroup): JsonResponse
    {
        $modifierGroup->delete();

        return response()->json(['message' => 'Modifier group deleted']);
    }

    // ── Modifier CRUD nested under group ─────────────────────────────────────

    public function storeModifier(Request $request, ModifierGroup $modifierGroup): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:100',
            'price' => 'numeric|min:0',
            'sort_order' => 'integer|min:0',
            'is_active' => 'boolean',
        ]);

        $modifier = $modifierGroup->modifiers()->create($validated);

        return response()->json(['data' => $modifier], 201);
    }

    public function updateModifier(Request $request, ModifierGroup $modifierGroup, \App\Models\Modifier $modifier): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'sometimes|string|max:100',
            'price' => 'numeric|min:0',
            'sort_order' => 'integer|min:0',
            'is_active' => 'boolean',
        ]);

        $modifier->update($validated);

        return response()->json(['data' => $modifier]);
    }

    public function destroyModifier(ModifierGroup $modifierGroup, \App\Models\Modifier $modifier): JsonResponse
    {
        $modifier->delete();

        return response()->json(['message' => 'Modifier deleted']);
    }
}
