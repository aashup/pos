<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Permission;
use App\Models\Role;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RoleController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Role::class);

        $query = Role::query()
            ->with('permissions')
            ->when($request->search, fn ($q) => $q->where('name', 'like', "%{$request->search}%"));

        $sortOrder = $request->sort_order === 'asc' ? 'asc' : 'desc';
        $query->orderBy('name', $request->sort_by === 'name' ? $sortOrder : 'asc');

        $roles = $query->paginate($request->per_page ?? 25);

        return response()->json($roles);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorize('create', Role::class);

        $validated = $request->validate([
            'name' => 'required|string|max:255|unique:roles,name',
            'permissions' => 'required|array',
            'permissions.*' => 'exists:permissions,uuid',
        ]);

        $role = Role::create([
            'name' => $validated['name'],
            'guard_name' => 'web',
        ]);

        $permissions = Permission::whereIn('uuid', $validated['permissions'])->get();
        $role->syncPermissions($permissions);

        return response()->json(['data' => $role->load('permissions')], 201);
    }

    public function show(Role $role): JsonResponse
    {
        $this->authorize('view', $role);

        return response()->json(['data' => $role->load('permissions')]);
    }

    public function update(Request $request, Role $role): JsonResponse
    {
        $this->authorize('update', $role);

        $roleKey = $role->getKey();

        $validated = $request->validate([
            'name' => "sometimes|string|max:255|unique:roles,name,{$roleKey},uuid",
            'permissions' => 'sometimes|array',
            'permissions.*' => 'exists:permissions,uuid',
        ]);

        if (isset($validated['name'])) {
            $role->update(['name' => $validated['name']]);
        }

        if (isset($validated['permissions'])) {
            $permissions = Permission::whereIn('uuid', $validated['permissions'])->get();
            $role->syncPermissions($permissions);
        }

        return response()->json(['data' => $role->fresh('permissions')]);
    }

    public function destroy(Role $role): JsonResponse
    {
        $this->authorize('delete', $role);

        $systemRoles = ['admin', 'manager', 'accountant', 'salesman'];
        if (in_array($role->name, $systemRoles)) {
            return response()->json(['message' => 'Cannot delete system roles'], 403);
        }

        $role->delete();

        return response()->json(['message' => 'Role deleted']);
    }

    public function permissions(): JsonResponse
    {
        $this->authorize('viewAny', Role::class);

        $permissions = Permission::orderBy('name', 'asc')->get();

        $grouped = $permissions->groupBy(function ($permission) {
            return explode('.', $permission->name)[0] ?? 'other';
        })->mapWithKeys(fn ($group, $module) => [
            $module => $group->values()->toArray(),
        ])->toArray();

        return response()->json(['data' => $grouped]);
    }
}
