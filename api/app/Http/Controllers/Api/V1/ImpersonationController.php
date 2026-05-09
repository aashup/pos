<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ImpersonationController extends Controller
{
    private const SUPER_EMAIL = 'aashu@xtrox.com';

    public function impersonate(Request $request, User $user): JsonResponse
    {
        if ($request->user()->email !== self::SUPER_EMAIL) {
            abort(403, 'Only the Xtrox super-admin can impersonate users.');
        }

        // Revoke any existing impersonation tokens for this target to avoid stale tokens
        $user->tokens()->where('name', 'like', 'impersonated_by_%')->delete();

        $token = $user->createToken('impersonated_by_' . self::SUPER_EMAIL)->plainTextToken;

        return response()->json([
            'message' => "Impersonating {$user->name}",
            'data' => [
                'token' => $token,
                'user'  => $user->load('company', 'branch'),
                'permissions' => $user->getAllPermissions()->pluck('name')->toArray(),
            ],
        ]);
    }

    public function stopImpersonating(Request $request, User $user): JsonResponse
    {
        if ($request->user()->email !== self::SUPER_EMAIL) {
            abort(403, 'Only the Xtrox super-admin can stop impersonating users.');
        }

        $deleted = $user->tokens()->where('name', 'like', 'impersonated_by_%')->delete();

        return response()->json([
            'message' => "Impersonation tokens revoked for {$user->name}",
            'tokens_revoked' => $deleted,
        ]);
    }
}
