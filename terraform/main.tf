provider "azurerm" {
  features {}
}

# 🌍 기존 리소스 그룹 읽기 (Final_2)
data "azurerm_resource_group" "unbrdn" {
  name = "Final_2"
}
