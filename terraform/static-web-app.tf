resource "azurerm_static_web_app" "frontend" {
  name                = "unbrdn-frontend"
  resource_group_name = local.rg_name
  location            = "East Asia"
  sku_tier            = "Free"
  sku_size            = "Free"
}

output "static_web_app_default_hostname" {
  value = azurerm_static_web_app.frontend.default_host_name
}

output "static_web_app_api_key" {
  description = "GitHub Actions 배포 토큰 — AZURE_STATIC_WEB_APPS_API_TOKEN secret에 저장"
  value       = azurerm_static_web_app.frontend.api_key
  sensitive   = true
}
