-- AlterTable: uploaded listing photos stored in S3 (Keystone image field `image`, storage my_images).
ALTER TABLE "PropertyMedia" ADD COLUMN     "image_extension" TEXT,
ADD COLUMN     "image_filesize" INTEGER,
ADD COLUMN     "image_height" INTEGER,
ADD COLUMN     "image_id" TEXT,
ADD COLUMN     "image_width" INTEGER;
