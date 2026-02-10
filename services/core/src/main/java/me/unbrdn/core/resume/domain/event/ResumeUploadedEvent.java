package me.unbrdn.core.resume.domain.event;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor
@AllArgsConstructor
public class ResumeUploadedEvent {
    private String resumeId;
    private String filePath;
    private String downloadUrl;
    private String validationText;
}
