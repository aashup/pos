<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class UserController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', User::class);

        $isSuperEmail = auth()->user()->email === 'aashu@xtrox.com';

        $query = User::query()
            ->with($isSuperEmail ? ['branch', 'company'] : ['branch'])
            ->when(! $isSuperEmail, fn ($q) => $q->where('company_id', auth()->user()->company_id))
            ->when($request->search, fn ($q) => $q->where(function ($q) use ($request) {
                $q->where('name', 'like', "%{$request->search}%")
                    ->orWhere('email', 'like', "%{$request->search}%");
            }))
            ->when($request->role, fn ($q) => $q->where('role', $request->role))
            ->when($request->has('is_active') && $request->is_active !== '', fn ($q) => $q->where('is_active', filter_var($request->is_active, FILTER_VALIDATE_BOOLEAN)))
            ->when($request->branch_id, fn ($q) => $q->where('branch_id', $request->branch_id));

        // Sorting
        if ($request->sort_by) {
            $sortOrder = $request->sort_order === 'asc' ? 'asc' : 'desc';

            match ($request->sort_by) {
                'name' => $query->orderBy('users.name', $sortOrder),
                'email' => $query->orderBy('users.email', $sortOrder),
                'role' => $query->orderBy('users.role', $sortOrder),
                'is_active' => $query->orderBy('users.is_active', $sortOrder),
                default => $query->orderBy('users.name', 'asc'),
            };
        } else {
            $query->orderBy('users.name', 'asc');
        }

        $users = $query->paginate($request->per_page ?? 25);

        return response()->json($users);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorize('create', User::class);

        $companyId = auth()->user()->company_id;

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => "required|email|max:255|unique:users,email,NULL,id,company_id,{$companyId}",
            'phone' => 'nullable|string|max:20',
            'role' => 'required|in:admin,manager,accountant,salesman',
            'branch_id' => 'nullable|exists:branches,id',
            'is_active' => 'boolean',
        ]);

        $validated['password'] = Str::random(12);
        $validated['company_id'] = $companyId;
        $validated['is_active'] = $validated['is_active'] ?? true;

        $user = User::create($validated);

        return response()->json(['data' => $user->load(['branch'])], 201);
    }

    public function show(User $user): JsonResponse
    {
        $this->authorize('view', $user);

        return response()->json(['data' => $user->load(['branch'])]);
    }

    public function update(Request $request, User $user): JsonResponse
    {
        $this->authorize('update', $user);

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'email' => "sometimes|email|max:255|unique:users,email,{$user->id},id,company_id,{$user->company_id}",
            'phone' => 'nullable|string|max:20',
            'role' => 'sometimes|in:admin,manager,accountant,salesman',
            'branch_id' => 'nullable|exists:branches,id',
            'is_active' => 'sometimes|boolean',
        ]);

        $user->update($validated);

        return response()->json(['data' => $user->load(['branch'])]);
    }

    public function destroy(User $user): JsonResponse
    {
        $this->authorize('delete', $user);

        // Prevent deleting the last admin of a company
        if ($user->role === 'admin') {
            $adminCount = User::where('company_id', $user->company_id)
                ->where('role', 'admin')
                ->where('id', '!=', $user->id)
                ->count();

            if ($adminCount === 0) {
                return response()->json(['message' => 'Cannot delete the last admin user'], 403);
            }
        }

        $user->delete();

        return response()->json(['message' => 'User deleted']);
    }
}
