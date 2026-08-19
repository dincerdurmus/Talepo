ALTER TABLE "Request" ADD COLUMN "requestNumber" SERIAL;
CREATE UNIQUE INDEX "Request_requestNumber_key" ON "Request"("requestNumber");
