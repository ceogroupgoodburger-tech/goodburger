CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_name` text,
	`customer_phone` text,
	`order_type` text NOT NULL,
	`address` text,
	`payment_method` text NOT NULL,
	`payment_status` text DEFAULT 'pending' NOT NULL,
	`mercado_pago_payment_id` text,
	`total_cents` integer NOT NULL,
	`payload` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
