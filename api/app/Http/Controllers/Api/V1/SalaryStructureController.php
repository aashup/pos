<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Employee;
use App\Models\SalaryStructure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SalaryStructureController extends Controller
{
    public function storeForEmployee(Request $request, Employee $employee): JsonResponse
    {
        $this->authorize('update', $employee);

        $validated = $request->validate([
            'effective_from' => 'required|date',
            'basic' => 'required|numeric|min:0',
            'hra' => 'nullable|numeric|min:0',
            'da' => 'nullable|numeric|min:0',
            'conveyance' => 'nullable|numeric|min:0',
            'medical' => 'nullable|numeric|min:0',
            'special_allowance' => 'nullable|numeric|min:0',
            'professional_tax'  => 'nullable|numeric|min:0',
            'tds_amount'        => 'nullable|numeric|min:0',
            'custom_components' => 'nullable|array',
            'custom_components.*.definition_id' => 'required|string',
            'custom_components.*.name'          => 'required|string',
            'custom_components.*.type'          => 'required|in:earning,deduction',
            'custom_components.*.amount'        => 'required|numeric|min:0',
        ]);

        // Deactivate previous structure
        SalaryStructure::where('employee_id', $employee->id)->update(['is_active' => false]);

        $structure = SalaryStructure::create(array_merge($validated, [
            'company_id' => $employee->company_id,
            'employee_id' => $employee->id,
            'is_active' => true,
        ]));

        return response()->json(['data' => $structure], 201);
    }

    public function show(SalaryStructure $salaryStructure): JsonResponse
    {
        return response()->json(['data' => $salaryStructure]);
    }

    public function update(Request $request, SalaryStructure $salaryStructure): JsonResponse
    {
        $validated = $request->validate([
            'effective_from' => 'sometimes|date',
            'basic' => 'sometimes|numeric|min:0',
            'hra' => 'nullable|numeric|min:0',
            'da' => 'nullable|numeric|min:0',
            'conveyance' => 'nullable|numeric|min:0',
            'medical' => 'nullable|numeric|min:0',
            'special_allowance' => 'nullable|numeric|min:0',
            'professional_tax' => 'nullable|numeric|min:0',
            'tds_amount' => 'nullable|numeric|min:0',
        ]);

        $salaryStructure->update($validated);

        return response()->json(['data' => $salaryStructure]);
    }

    public function destroy(SalaryStructure $salaryStructure): JsonResponse
    {
        $salaryStructure->delete();

        return response()->json(['message' => 'Salary structure deleted']);
    }
}
