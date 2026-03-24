# 🌍 전면 Azure 100% Terraform Provider

provider "azurerm" {
  features {}
}

# 1. 리소스 그룹부 (신규 생성 분기)
resource "azurerm_resource_group" "rg" {
  count    = var.create_resource_group ? 1 : 0
  name     = var.resource_group_name
  location = "Korea Central"
}

# 2. 리소스 그룹부 (기존 자원 읽기 분기)
data "azurerm_resource_group" "rg" {
  count = var.create_resource_group ? 0 : 1
  name  = var.resource_group_name
}

# 스크립트 전역 매핑 동적 대응 지역 변수
locals {
  rg_name     = var.create_resource_group ? azurerm_resource_group.rg[0].name : data.azurerm_resource_group.rg[0].name
  rg_location = var.create_resource_group ? azurerm_resource_group.rg[0].location : data.azurerm_resource_group.rg[0].location
}
