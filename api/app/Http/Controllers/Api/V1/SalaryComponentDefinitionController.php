<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\SalaryComponentDefinition;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SalaryComponentDefinitionController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        abort_unless($request->user()->hasPermissionTo('payroll.view'), 403);

        $query = SalaryComponentDefinition::query()->orderBy('type')->orderBy('name');

        if ($request->filled('type')) {
            $query->where('type', $request->type);
        }

        if ($request->boolean('active_only')) {
            $query->where('is_active', true);
        }

        return response()->json(['data' => $query->get()]);
    }

    public function store(Request $request): JsonResponse
    {
        abort_unless($request->user()->hasPermissionTo('payroll.create'), 403);

        $validated = $request->validate([
            'name' => 'required|string|max:100',
            'type' => 'required|in:earning,deduction',
        ]);

        $definition = SalaryComponentDefinition::create($validated);

        return response()->json(['data' => $definition], 201);
    }

    public function update(Request $request, SalaryComponentDefinition $salaryComponentDefinition): JsonResponse
    {
        abort_unless($request->user()->hasPermissionTo('payroll.edit'), 403);

        $validated = $request->validate([
            'name'      => 'sometimes|string|max:100',
            'type'      => 'sometimes|in:earning,deduction',
            'is_active' => 'sometimes|boolean',
        ]);

        $salaryComponentDefinition->update($validated);

        return response()->json(['data' => $salaryComponentDefinition]);
    }

    public function destroy(Request $request, SalaryComponentDefinition $salaryComponentDefinition): JsonResponse
    {
        abort_unless($request->user()->hasPermissionTo('payroll.delete'), 403);

        $salaryComponentDefinition->delete();

        return response()->json(['message' => 'Component definition deleted']);
    }
}
