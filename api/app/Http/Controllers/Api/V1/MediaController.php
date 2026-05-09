<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Media;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class MediaController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'entity_type' => 'required|in:item,item_variant,combo,modifier_group',
            'entity_id' => 'required|uuid',
        ]);

        $media = Media::where('entity_type', $request->entity_type)
            ->where('entity_id', $request->entity_id)
            ->orderBy('sort_order')
            ->get();

        return response()->json(['data' => $media]);
    }

    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'entity_type' => 'required|in:item,item_variant,combo,modifier_group',
            'entity_id' => 'required|uuid',
            'image' => 'required|image|max:5120', // 5 MB max
            'sort_order' => 'integer|min:0',
            'is_primary' => 'boolean',
        ]);

        $path = $request->file('image')->store('media', 'public');
        $url = Storage::disk('public')->url($path);

        if ($request->boolean('is_primary')) {
            Media::where('entity_type', $request->entity_type)
                ->where('entity_id', $request->entity_id)
                ->update(['is_primary' => false]);
        }

        $media = Media::create([
            'company_id' => $request->user()->company_id,
            'entity_type' => $request->entity_type,
            'entity_id' => $request->entity_id,
            'url' => $url,
            'storage_path' => $path,
            'disk' => 'public',
            'sort_order' => $request->integer('sort_order', 0),
            'is_primary' => $request->boolean('is_primary', false),
        ]);

        return response()->json(['data' => $media], 201);
    }

    public function destroy(Media $medium): JsonResponse
    {
        $medium->deleteFile();
        $medium->delete();

        return response()->json(['message' => 'Image deleted']);
    }

    public function setPrimary(Media $medium): JsonResponse
    {
        Media::where('entity_type', $medium->entity_type)
            ->where('entity_id', $medium->entity_id)
            ->update(['is_primary' => false]);

        $medium->update(['is_primary' => true]);

        return response()->json(['data' => $medium]);
    }
}
