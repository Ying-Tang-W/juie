<?php
// Copy to config.php and fill in the database values. Keep config.php private.
return [
  'db' => ['host' => '127.0.0.1', 'name' => 'image_notes', 'user' => 'SET_DB_USER', 'pass' => 'SET_DB_PASSWORD', 'charset' => 'utf8mb4'],
  'upload_dir' => __DIR__ . '/storage/photos',
  'upload_url' => 'server/storage/photos',
  'max_upload_bytes' => 20 * 1024 * 1024,
];
