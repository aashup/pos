<?php

use App\Http\Controllers\WebAuthController;
use Illuminate\Support\Facades\Route;

Route::prefix('api')->group(function () {
    Route::get('/', [WebAuthController::class, 'showLogin']);
    Route::post('/login', [WebAuthController::class, 'login']);
    Route::post('/logout', [WebAuthController::class, 'logout']);
    Route::get('/home', [WebAuthController::class, 'home'])->middleware('auth:web');
});
