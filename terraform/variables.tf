# 📄 Terraform 변수 서술 및 동적 활정 플래그

variable "create_resource_group" {
  description = "리소스 그룹을 새로 생성할지 여부"
  type        = bool
  default     = false
}

variable "resource_group_name" {
  description = "리소스 그룹 이름"
  type        = string
  default     = "Final_2"
}

variable "create_aks" {
  description = "AKS 클러스터를 새로 생성할지 여부"
  type        = bool
  default     = false
}

variable "aks_cluster_name" {
  description = "AKS 클러스터 이름"
  type        = string
  default     = "unbrdn-aks"
}

variable "db_password" {
  description = "Postgres DB 관리자 비밀번호"
  type        = string
  default     = "SecurePassword123!"
}
