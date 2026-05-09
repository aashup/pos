<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\DocumentCounter;
use App\Models\Voucher;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DocumentCounterController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $request->validate(['financial_year_id' => 'required|uuid']);

        $companyId = $request->user()->company_id;
        $fyId = $request->financial_year_id;

        $counters = DocumentCounter::where('company_id', $companyId)
            ->where('financial_year_id', $fyId)
            ->orderBy('document_type')
            ->get();

        $isLocked = Voucher::where('financial_year_id', $fyId)
            ->where('company_id', $companyId)
            ->exists();

        return response()->json([
            'data'      => $counters,
            'is_locked' => $isLocked,
        ]);
    }

    public function update(Request $request, DocumentCounter $documentCounter): JsonResponse
    {
        $companyId = $request->user()->company_id;

        if ($documentCounter->company_id !== $companyId) {
            abort(403);
        }

        $isLocked = Voucher::where('financial_year_id', $documentCounter->financial_year_id)
            ->where('company_id', $companyId)
            ->exists();

        if ($isLocked) {
            return response()->json([
                'message' => 'Cannot edit counters after transactions have been recorded for this financial year.',
            ], 422);
        }

        $validated = $request->validate([
            'prefix'      => 'nullable|string|max:50',
            'next_number' => 'required|integer|min:1',
        ]);

        $documentCounter->update($validated);

        return response()->json(['data' => $documentCounter]);
    }
}
