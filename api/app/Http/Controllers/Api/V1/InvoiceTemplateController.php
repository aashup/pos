<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\InvoiceTemplateRegistry;
use Illuminate\Http\JsonResponse;

class InvoiceTemplateController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json([
            'data' => InvoiceTemplateRegistry::getAll(),
        ]);
    }
}
