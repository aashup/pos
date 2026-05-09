<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Designation;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DesignationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $designations = Designation::query()
            ->with('department')
            ->when($request->search, fn ($q, $s) => $q->where('name', 'like', "%{$s}%"))
            ->when($request->department_id, fn ($q, $d) => $q->where('department_id', $d))
            ->when($request->boolean('active_only'), fn ($q) => $q->where('is_active', true))
            ->orderBy('name')
            ->paginate($request->per_page ?? 50);

        return response()->json($designations);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorize('create', Designation::class);

        $validated = $request->validate([
            'department_id' => 'nullable|exists:departments,id',
            'name' => 'required|string|max:255',
            'is_active' => 'boolean',
        ]);

        $designation = Designation::create($validated);

        return response()->json(['data' => $designation->load('department')], 201);
    }

    public function show(Designation $designation): JsonResponse
    {
        return response()->json(['data' => $designation->load('department')]);
    }

    public function update(Request $request, Designation $designation): JsonResponse
    {
        $this->authorize('update', $designation);

        $validated = $request->validate([
            'department_id' => 'nullable|exists:departments,id',
            'name' => 'sometimes|string|max:255',
            'is_active' => 'boolean',
        ]);

        $designation->update($validated);

        return response()->json(['data' => $designation->load('department')]);
    }

    public function destroy(Designation $designation): JsonResponse
    {
        $this->authorize('delete', $designation);

        $designation->delete();

        return response()->json(['message' => 'Designation deleted']);
    }
}
