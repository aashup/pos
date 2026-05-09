<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Branch;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BranchController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Branch::class);

        $query = Branch::query()
            ->when($request->boolean('active_only'), fn ($q) => $q->where('is_active', true));

        // Sorting
        if ($request->sort_by) {
            $sortOrder = $request->sort_order === 'asc' ? 'asc' : 'desc';

            match ($request->sort_by) {
                'name' => $query->orderBy('branches.name', $sortOrder),
                'code' => $query->orderBy('branches.code', $sortOrder),
                'city' => $query->orderBy('branches.city', $sortOrder),
                'state' => $query->orderBy('branches.state', $sortOrder),
                'is_active' => $query->orderBy('branches.is_active', $sortOrder),
                default => $query->orderBy('branches.name', 'asc'),
            };
        } else {
            $query->orderBy('branches.name', 'asc');
        }

        $branches = $query->paginate($request->per_page ?? 25);

        return response()->json($branches);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorize('create', Branch::class);

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'code' => 'nullable|string|max:50',
            'address' => 'nullable|string',
            'city' => 'nullable|string|max:100',
            'state' => 'nullable|string|max:100',
            'state_code' => 'nullable|string|size:2',
        ]);

        $branch = Branch::create($validated);

        return response()->json(['data' => $branch], 201);
    }

    public function show(Branch $branch): JsonResponse
    {
        $this->authorize('view', $branch);

        return response()->json(['data' => $branch->load('godowns')]);
    }

    public function update(Request $request, Branch $branch): JsonResponse
    {
        $this->authorize('update', $branch);

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'code' => 'nullable|string|max:50',
            'address' => 'nullable|string',
            'city' => 'nullable|string|max:100',
            'state' => 'nullable|string|max:100',
            'state_code' => 'nullable|string|size:2',
            'is_active' => 'boolean',
        ]);

        $branch->update($validated);

        return response()->json(['data' => $branch]);
    }

    public function destroy(Branch $branch): JsonResponse
    {
        $this->authorize('delete', $branch);

        $branch->delete();

        return response()->json(['message' => 'Branch deleted']);
    }
}
