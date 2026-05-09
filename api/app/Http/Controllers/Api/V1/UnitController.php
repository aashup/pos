<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Unit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class UnitController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Unit::class);

        $units = Unit::when($request->search, fn ($q, $s) => $q->where('value', 'like', "%{$s}%")->orWhere('label', 'like', "%{$s}%"))
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->status));

        // Sorting
        if ($request->sort_by) {
            $sortOrder = $request->sort_order === 'desc' ? 'desc' : 'asc';

            match ($request->sort_by) {
                'value' => $units->orderBy('value', $sortOrder),
                'label' => $units->orderBy('label', $sortOrder),
                'status' => $units->orderBy('status', $sortOrder),
                default => $units->orderBy('value'),
            };
        } else {
            $units->orderBy('value');
        }

        $paginated = $units->paginate($request->per_page ?? 25);

        return response()->json($paginated);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorize('create', Unit::class);

        $validated = $request->validate([
            'value' => 'required|string|max:20|unique:units,value,NULL,id,company_id,'.$request->user()->company_id,
            'label' => 'required|string|max:255',
            'status' => 'required|in:active,inactive',
        ]);

        $validated['company_id'] = $request->user()->company_id;
        $unit = Unit::create($validated);

        return response()->json(['data' => $unit], 201);
    }

    public function show(Unit $unit): JsonResponse
    {
        $this->authorize('view', $unit);

        return response()->json(['data' => $unit]);
    }

    public function update(Request $request, Unit $unit): JsonResponse
    {
        $this->authorize('update', $unit);

        $validated = $request->validate([
            'value' => "required|string|max:20|unique:units,value,{$unit->id},id,company_id,".$request->user()->company_id,
            'label' => 'required|string|max:255',
            'status' => 'required|in:active,inactive',
        ]);

        $unit->update($validated);

        return response()->json(['data' => $unit]);
    }

    public function destroy(Unit $unit): JsonResponse
    {
        $this->authorize('delete', $unit);

        $unit->delete();

        return response()->json(status: 204);
    }
}
