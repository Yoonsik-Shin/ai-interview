package me.unbrdn.core.auth.adapter.in.http;

import java.util.Map;
import lombok.RequiredArgsConstructor;
import me.unbrdn.core.auth.domain.service.JwtJwksProvider;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/.well-known")
@RequiredArgsConstructor
public class JwksController {
    private final JwtJwksProvider jwksProvider;

    @GetMapping("/jwks.json")
    public Map<String, Object> jwks() {
        return jwksProvider.getJwks();
    }
}
