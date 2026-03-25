# Azure DNS Zone + 레코드 관리

resource "azurerm_dns_zone" "main" {
  name                = "unbrdn.me"
  resource_group_name = local.rg_name
}

# Ingress LoadBalancer IP → A 레코드
resource "azurerm_dns_a_record" "root" {
  name                = "@"
  zone_name           = azurerm_dns_zone.main.name
  resource_group_name = local.rg_name
  ttl                 = 300
  records             = [var.ingress_ip]
}

resource "azurerm_dns_a_record" "www" {
  name                = "www"
  zone_name           = azurerm_dns_zone.main.name
  resource_group_name = local.rg_name
  ttl                 = 300
  records             = [var.ingress_ip]
}

resource "azurerm_dns_a_record" "argocd" {
  name                = "argocd"
  zone_name           = azurerm_dns_zone.main.name
  resource_group_name = local.rg_name
  ttl                 = 300
  records             = [var.ingress_ip]
}

# Azure DNS 네임서버 출력 (도메인 등록기관에서 이 값으로 NS 변경)
output "dns_nameservers" {
  description = "도메인 등록기관에서 이 네임서버로 변경하세요"
  value       = azurerm_dns_zone.main.name_servers
}

output "ingress_ip" {
  description = "현재 Ingress LoadBalancer IP"
  value       = var.ingress_ip
}
