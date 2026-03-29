package me.unbrdn.core.interview.application.port.out;

public interface GetSegmentStorageUrlPort {
    String getUploadUrl(String objectKey, int expirationSeconds);

    String getDownloadUrl(String objectKey, int expirationSeconds);
}
