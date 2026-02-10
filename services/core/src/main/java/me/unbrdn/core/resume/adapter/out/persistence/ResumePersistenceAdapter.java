package me.unbrdn.core.resume.adapter.out.persistence;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import me.unbrdn.core.resume.application.port.out.DeleteResumePort;
import me.unbrdn.core.resume.application.port.out.LoadResumePort;
import me.unbrdn.core.resume.application.port.out.LoadResumesByUserPort;
import me.unbrdn.core.resume.application.port.out.LoadUserPort;
import me.unbrdn.core.resume.application.port.out.SaveResumePort;
import me.unbrdn.core.resume.application.port.out.SearchResumeByVectorPort;
import me.unbrdn.core.resume.domain.entity.Resumes;
import me.unbrdn.core.resume.domain.repository.ResumesRepository;
import me.unbrdn.core.user.domain.entity.User;
import me.unbrdn.core.user.domain.repository.UsersRepository;
import org.springframework.stereotype.Component;

/** 이력서 Persistence Adapter */
@Component("resumePersistenceAdapter")
@RequiredArgsConstructor
public class ResumePersistenceAdapter
        implements LoadUserPort,
                SaveResumePort,
                LoadResumePort,
                LoadResumesByUserPort,
                SearchResumeByVectorPort,
                DeleteResumePort {

    private final UsersRepository usersRepository;
    private final ResumesRepository resumesRepository;
    private final org.springframework.jdbc.core.JdbcTemplate jdbcTemplate;

    @Override
    public Optional<User> loadUserById(UUID userId) {
        return usersRepository.findById(userId);
    }

    @Override
    public Optional<Resumes> loadResumeById(UUID resumeId) {
        return resumesRepository.findById(resumeId);
    }

    @Override
    public Optional<Resumes> loadByUserIdAndFileHash(UUID userId, String fileHash) {
        return resumesRepository.findByUser_IdAndFileHash(userId, fileHash);
    }

    @Override
    public Resumes save(Resumes resume) {
        return resumesRepository.save(resume);
    }

    @Override
    public List<Resumes> loadResumesByUserId(UUID userId) {
        return resumesRepository.findByUser_Id(userId);
    }

    @Override
    public void deleteById(String id) {
        resumesRepository.deleteById(UUID.fromString(id));
    }

    @Override
    public List<Resumes> searchSimilarResumes(
            UUID userId, float[] vector, double threshold, int limit) {
        String dbType = getDatabaseType();
        String vectorString = toVectorString(vector);

        String sql;
        if (dbType.contains("PostgreSQL")) {
            sql =
                    "SELECT id FROM resumes "
                            + "WHERE user_id = ? AND (1 - (embedding <=> ?::vector)) >= ? "
                            + "ORDER BY embedding <=> ?::vector LIMIT ?";
        } else {
            // Oracle
            sql =
                    "SELECT id FROM resumes "
                            + "WHERE user_id = ? AND (1 - VECTOR_DISTANCE(embedding, TO_VECTOR(?), COSINE)) >= ? "
                            + "ORDER BY VECTOR_DISTANCE(embedding, TO_VECTOR(?), COSINE) "
                            + "FETCH FIRST ? ROWS ONLY";
        }

        List<UUID> ids =
                jdbcTemplate.query(
                        sql,
                        (rs, rowNum) -> (UUID) rs.getObject("id"),
                        userId,
                        vectorString,
                        threshold,
                        vectorString,
                        limit);

        return resumesRepository.findAllById(ids);
    }

    private String getDatabaseType() {
        try {
            return jdbcTemplate
                    .getDataSource()
                    .getConnection()
                    .getMetaData()
                    .getDatabaseProductName();
        } catch (Exception e) {
            return "Unknown";
        }
    }

    private String toVectorString(float[] vector) {
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < vector.length; i++) {
            sb.append(vector[i]);
            if (i < vector.length - 1) sb.append(",");
        }
        sb.append("]");
        return sb.toString();
    }
}
