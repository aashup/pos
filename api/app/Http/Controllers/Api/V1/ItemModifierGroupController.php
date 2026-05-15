<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ItemModifierGroupController extends Controller
{
    /**
     * Paginated list of item ↔ modifier-group pivot rows for the current company.
     * Used by the POS sync worker to populate the local SQLite item_modifier_groups table.
     */
    public function index(Request $request): JsonResponse
    {
        $perPage = min((int) $request->input('per_page', 200), 500);

        $rows = DB::table('item_modifier_groups as img')
            ->join('items', 'items.id', '=', 'img.item_id')
            ->where('items.company_id', $request->user()->company_id)
            ->whereNull('items.deleted_at')
            ->select(
                'img.id',
                'img.item_id',
                'img.modifier_group_id',
                'img.sort_order',
                'img.created_at',
                'img.updated_at',
            )
            ->orderBy('img.item_id')
            ->orderBy('img.sort_order')
            ->paginate($perPage);

        return response()->json($rows);
    }
}
