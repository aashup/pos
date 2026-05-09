<?php

namespace App\Models;

use App\Traits\BelongsToCompany;
use App\Traits\HasSyncColumns;
use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;

class Media extends Model
{
    use BelongsToCompany, HasSyncColumns, HasUuid;

    protected $fillable = [
        'company_id',
        'entity_type',
        'entity_id',
        'url',
        'storage_path',
        'disk',
        'sort_order',
        'is_primary',
    ];

    protected function casts(): array
    {
        return [
            'sort_order' => 'integer',
            'is_primary' => 'boolean',
        ];
    }

    public function deleteFile(): bool
    {
        return Storage::disk($this->disk)->delete($this->storage_path);
    }
}
