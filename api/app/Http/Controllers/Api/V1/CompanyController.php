<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Company;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class CompanyController extends Controller
{
    public function show(Company $company): JsonResponse
    {
        $user = auth()->user();

        // Users can only view their own company
        if ($user->company_id !== $company->id) {
            abort(403, 'Unauthorized');
        }

        return response()->json(['data' => $company]);
    }

    public function update(Request $request, Company $company): JsonResponse
    {
        $user = auth()->user();

        // Users can only update their own company
        if ($user->company_id !== $company->id) {
            abort(403, 'Unauthorized');
        }

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'gstin' => 'nullable|string|max:15',
            'pan' => 'nullable|string|max:10',
            'address' => 'nullable|string|max:500',
            'city' => 'nullable|string|max:100',
            'state' => 'nullable|string|max:100',
            'state_code' => 'nullable|string|size:2',
            'pincode' => 'nullable|string|max:10',
            'phone' => 'nullable|string|max:20',
            'email' => 'nullable|email|max:255',
        ]);

        $company->update($validated);

        return response()->json(['data' => $company->fresh()]);
    }

    public function uploadLogo(Request $request, Company $company): JsonResponse
    {
        $user = auth()->user();

        if ($user->company_id !== $company->id) {
            abort(403, 'Unauthorized');
        }

        $request->validate([
            'logo' => 'required|file|image|mimes:jpeg,png,webp|max:2048',
        ]);

        if ($company->logo_path) {
            Storage::disk('public')->delete($company->logo_path);
        }

        $file = $request->file('logo');
        $path = $file->storeAs(
            'company-logos/'.$company->id,
            Str::uuid().'.'.($file->getClientOriginalExtension() ?: 'jpg'),
            'public'
        );

        $company->update(['logo_path' => $path]);

        return response()->json([
            'message' => 'Logo updated successfully',
            'data' => $company->fresh(),
        ]);
    }
}
