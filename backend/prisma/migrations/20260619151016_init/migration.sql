-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'employee',
    "full_name" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "employees" (
    "full_name" TEXT NOT NULL PRIMARY KEY,
    "department" TEXT
);

-- CreateTable
CREATE TABLE "attendance_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "full_name" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "raw_value" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    CONSTRAINT "attendance_logs_full_name_fkey" FOREIGN KEY ("full_name") REFERENCES "employees" ("full_name") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_logs_full_name_date_key" ON "attendance_logs"("full_name", "date");
