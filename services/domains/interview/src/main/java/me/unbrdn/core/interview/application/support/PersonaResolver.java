package me.unbrdn.core.interview.application.support;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import org.springframework.stereotype.Component;

@Component
public class PersonaResolver {

    private static final List<String> LEAD_PRIORITY =
            Arrays.asList("LEADER", "MAIN", "EXEC", "HR", "TECH");

    public String resolveLeadPersona(List<String> personas) {
        if (personas == null || personas.isEmpty()) {
            return "LEADER";
        }

        for (String priority : LEAD_PRIORITY) {
            for (String persona : personas) {
                if (priority.equalsIgnoreCase(persona)) {
                    return persona;
                }
            }
        }

        return personas.get(0);
    }

    public List<String> resolveLeadOnly(List<String> personas) {
        return Collections.singletonList(resolveLeadPersona(personas));
    }
}
