# 🐘 Azure Database for PostgreSQL (Flexible Server)

# Postgres Config Server (버스터블 B2s 조율)
resource "azurerm_postgresql_flexible_server" "db" {
  name                   = "unbrdn-postgres-server"
  resource_group_name    = azurerm_resource_group.unbrdn.name
  location               = azurerm_resource_group.unbrdn.location
  version                = "15"
  administrator_login    = "psqladmin"
  administrator_password = "SecurePassword123!" # 실제 프로덕션 패스워드 주입 가변화

  sku_name   = "GP_Standard_D2s_v3" # 비용 상쇄용 가변화
  storage_mb = 32768
}

# 🔴 Azure Cache for Redis (Track 3)
resource "azurerm_redis_cache" "redis" {
  name                = "unbrdn-redis-track3"
  resource_group_name = azurerm_resource_group.unbrdn.name
  location            = azurerm_resource_group.unbrdn.location
  capacity            = 1
  family              = "C"
  sku_name            = "Standard" # Master/Replica 페일오버 지원
  enable_non_ssl_port = false
}
