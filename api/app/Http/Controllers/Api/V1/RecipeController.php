<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Recipe;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RecipeController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $recipes = Recipe::with('item', 'ingredients.stockItem')
            ->where('company_id', $request->user()->company_id)
            ->when($request->item_id, fn ($q, $id) => $q->where('item_id', $id))
            ->get();

        return response()->json(['data' => $recipes]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'item_id'              => 'required|uuid|exists:items,id',
            'variant_label'        => 'nullable|string|max:100',
            'notes'                => 'nullable|string',
            'ingredients'          => 'required|array|min:1',
            'ingredients.*.item_id'=> 'required|uuid|exists:items,id',
            'ingredients.*.quantity'=> 'required|numeric|min:0.0001',
            'ingredients.*.unit'   => 'required|string|max:20',
        ]);

        $recipe = Recipe::create([
            'company_id'   => $request->user()->company_id,
            'item_id'      => $validated['item_id'],
            'variant_label'=> $validated['variant_label'] ?? null,
            'notes'        => $validated['notes'] ?? null,
        ]);

        foreach ($validated['ingredients'] as $ingredient) {
            $recipe->ingredients()->create($ingredient);
        }

        return response()->json(['data' => $recipe->load('item', 'ingredients.stockItem')], 201);
    }

    public function show(Recipe $recipe): JsonResponse
    {
        return response()->json(['data' => $recipe->load('item', 'ingredients.stockItem')]);
    }

    public function update(Request $request, Recipe $recipe): JsonResponse
    {
        $validated = $request->validate([
            'variant_label'        => 'nullable|string|max:100',
            'notes'                => 'nullable|string',
            'ingredients'          => 'required|array|min:1',
            'ingredients.*.item_id'=> 'required|uuid|exists:items,id',
            'ingredients.*.quantity'=> 'required|numeric|min:0.0001',
            'ingredients.*.unit'   => 'required|string|max:20',
        ]);

        $recipe->update([
            'variant_label' => $validated['variant_label'] ?? null,
            'notes'         => $validated['notes'] ?? null,
        ]);

        $recipe->ingredients()->delete();
        foreach ($validated['ingredients'] as $ingredient) {
            $recipe->ingredients()->create($ingredient);
        }

        return response()->json(['data' => $recipe->load('item', 'ingredients.stockItem')]);
    }

    public function destroy(Recipe $recipe): JsonResponse
    {
        $recipe->ingredients()->delete();
        $recipe->delete();

        return response()->json(['message' => 'Recipe deleted']);
    }
}
