<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\CompanySetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class CompanySettingController extends Controller
{
    /**
     * Get all settings for the authenticated user's company.
     */
    public function index(Request $request): JsonResponse
    {
        $companyId = $request->user()->company_id;
        $settings = CompanySetting::getFormattedSettings($companyId);

        return response()->json(['data' => $settings]);
    }

    /**
     * Update (upsert) settings for the authenticated user's company.
     * Accepts: { "settings": { "key1": "value1", "key2": "value2" } }
     */
    public function update(Request $request): JsonResponse
    {
        $request->validate([
            'settings' => 'required|array',
        ]);

        $companyId = $request->user()->company_id;

        foreach ($request->input('settings') as $key => $value) {
            if ($key === CompanySetting::ITEM_UNITS_KEY) {
                $normalizedUnits = CompanySetting::normalizeItemUnits($value);

                if ($normalizedUnits === []) {
                    throw ValidationException::withMessages([
                        'settings.item_units' => 'At least one item unit is required.',
                    ]);
                }

                CompanySetting::setValue($companyId, $key, $normalizedUnits);

                continue;
            }

            if ($value !== null && (! is_string($value) || mb_strlen($value) > 1000)) {
                throw ValidationException::withMessages([
                    "settings.{$key}" => 'This setting must be a string up to 1000 characters.',
                ]);
            }

            CompanySetting::setValue($companyId, $key, $value);
        }

        $settings = CompanySetting::getFormattedSettings($companyId);

        return response()->json([
            'message' => 'Settings updated successfully',
            'data' => $settings,
        ]);
    }
}
