<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\FloorPlan;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FloorPlanController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $floorPlans = FloorPlan::with('tables')
            ->where('company_id', $request->user()->company_id)
            ->orderBy('sort_order')
            ->get();

        return response()->json(['data' => $floorPlans]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name'       => 'required|string|max:100',
            'sort_order' => 'nullable|integer|min:0',
        ]);

        $floorPlan = FloorPlan::create([
            ...$validated,
            'company_id' => $request->user()->company_id,
        ]);

        return response()->json(['data' => $floorPlan->load('tables')], 201);
    }

    public function show(FloorPlan $floorPlan): JsonResponse
    {
        return response()->json(['data' => $floorPlan->load('tables')]);
    }

    public function update(Request $request, FloorPlan $floorPlan): JsonResponse
    {
        $validated = $request->validate([
            'name'       => 'required|string|max:100',
            'sort_order' => 'nullable|integer|min:0',
        ]);

        $floorPlan->update($validated);

        return response()->json(['data' => $floorPlan->load('tables')]);
    }

    public function destroy(FloorPlan $floorPlan): JsonResponse
    {
        if ($floorPlan->tables()->where('is_active', true)->exists()) {
            return response()->json(['message' => 'Cannot delete a floor plan with active tables'], 422);
        }

        $floorPlan->delete();

        return response()->json(['message' => 'Floor plan deleted']);
    }
}
