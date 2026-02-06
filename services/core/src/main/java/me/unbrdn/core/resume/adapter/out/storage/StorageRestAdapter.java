package me.unbrdn.core.resume.adapter.out.storage;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import me.unbrdn.core.resume.application.port.out.GeneratePresignedUrlPort;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class StorageRestAdapter implements GeneratePresignedUrlPort {

    private final RestTemplate restTemplate;

    @Value("${storage.url}")
    private String storageUrl;

    @Override
    public String generateUploadUrl(String objectKey) {
        return callPresignedUrlApi(objectKey, "put_object");
    }

    @Override
    public String generateDownloadUrl(String objectKey) {
        return callPresignedUrlApi(objectKey, "get_object");
    }

    private String callPresignedUrlApi(String objectKey, String method) {
        String url = storageUrl + "/presigned-url";

        Map<String, Object> request = new HashMap<>();
        request.put("object_key", objectKey);
        request.put("method", method);

        try {
            @SuppressWarnings("unchecked")
            Map<String, String> response = restTemplate.postForObject(url, request, Map.class);
            if (response != null && response.containsKey("url")) {
                return response.get("url");
            }
        } catch (Exception e) {
            log.error("Failed to generate presigned URL ({}) from storage service: {}", method, e.getMessage());
        }
        return null;
    }
}
