<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Requests\Auth\RegisterRequest;
use App\Models\Company;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function register(RegisterRequest $request): JsonResponse
    {
        $data = DB::transaction(function () use ($request) {
            $company = Company::create([
                'name' => $request->company_name,
                'gstin' => $request->gstin,
                'state' => $request->state,
                'state_code' => $request->state_code,
            ]);

            $user = User::create([
                'company_id' => $company->id,
                'name' => $request->name,
                'email' => $request->email,
                'phone' => $request->phone,
                'password' => Hash::make($request->password),
                'role' => 'admin',
                'is_active' => true,
            ]);

            $user->assignRole('admin');

            $token = $user->createToken($request->input('device_name', 'default'))->plainTextToken;
            $permissions = $user->getAllPermissions()->pluck('name')->toArray();

            return compact('company', 'user', 'token', 'permissions');
        });

        return response()->json([
            'message' => 'Registration successful',
            'data' => $data,
        ], 201);
    }

    public function login(LoginRequest $request): JsonResponse
    {
        $user = User::where('email', $request->email)->first();

        if (! $user || ! Hash::check($request->password, $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['The provided credentials are incorrect.'],
            ]);
        }

        if (! $user->is_active) {
            throw ValidationException::withMessages([
                'email' => ['Your account has been deactivated.'],
            ]);
        }

        $token = $user->createToken($request->device_name)->plainTextToken;
        $user->load('company', 'branch');

        return response()->json([
            'message' => 'Login successful',
            'data' => [
                'user' => $user,
                'permissions' => $user->getAllPermissions()->pluck('name')->toArray(),
                'token' => $token,
            ],
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        $user = $request->user()->load('company', 'branch');

        return response()->json([
            'data' => $user,
            'permissions' => $user->getAllPermissions()->pluck('name')->toArray(),
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['message' => 'Logged out successfully']);
    }

    public function logoutAll(Request $request): JsonResponse
    {
        $request->user()->tokens()->delete();

        return response()->json(['message' => 'All sessions terminated']);
    }

    public function updateProfile(Request $request): JsonResponse
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email,'.$request->user()->id,
            'phone' => 'nullable|string|max:20',
        ]);

        $user = $request->user();
        $user->update($request->only('name', 'email', 'phone'));
        $user->load('company', 'branch');

        return response()->json([
            'message' => 'Profile updated successfully',
            'data' => $user,
        ]);
    }

    public function uploadAvatar(Request $request): JsonResponse
    {
        $request->validate([
            'avatar' => 'required|file|image|mimes:jpeg,png,webp|max:2048',
        ]);

        $user = $request->user();

        if ($user->profile_image_path) {
            Storage::disk('public')->delete($user->profile_image_path);
        }

        $file = $request->file('avatar');
        $path = $file->storeAs(
            'profile-images/'.$user->id,
            Str::uuid().'.'.($file->getClientOriginalExtension() ?: 'jpg'),
            'public'
        );

        $user->update(['profile_image_path' => $path]);
        $user->load('company', 'branch');

        return response()->json([
            'message' => 'Avatar updated successfully',
            'data' => $user,
        ]);
    }

    public function updatePassword(Request $request): JsonResponse
    {
        $request->validate([
            'current_password' => 'required|string',
            'password' => 'required|string|min:8|confirmed',
            'password_confirmation' => 'required|string',
        ]);

        $user = $request->user();

        if (! Hash::check($request->current_password, $user->password)) {
            throw ValidationException::withMessages([
                'current_password' => ['The current password is incorrect.'],
            ]);
        }

        $user->update(['password' => Hash::make($request->password)]);

        return response()->json(['message' => 'Password changed successfully']);
    }
}
