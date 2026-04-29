export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      access_logs: {
        Row: {
          action: string
          created_at: string
          email: string | null
          geo_endereco: string | null
          geo_lat: number | null
          geo_lng: number | null
          id: string
          ip: string | null
          provider: string | null
          reason: string | null
          reason_context: string | null
          ref_id: string | null
          ref_table: string | null
          success: boolean
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          email?: string | null
          geo_endereco?: string | null
          geo_lat?: number | null
          geo_lng?: number | null
          id?: string
          ip?: string | null
          provider?: string | null
          reason?: string | null
          reason_context?: string | null
          ref_id?: string | null
          ref_table?: string | null
          success?: boolean
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          email?: string | null
          geo_endereco?: string | null
          geo_lat?: number | null
          geo_lng?: number | null
          id?: string
          ip?: string | null
          provider?: string | null
          reason?: string | null
          reason_context?: string | null
          ref_id?: string | null
          ref_table?: string | null
          success?: boolean
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          google_sheet_id: string | null
          id: number
          sync_enabled: boolean
          updated_at: string
        }
        Insert: {
          google_sheet_id?: string | null
          id?: number
          sync_enabled?: boolean
          updated_at?: string
        }
        Update: {
          google_sheet_id?: string | null
          id?: number
          sync_enabled?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      authorized_emails: {
        Row: {
          activated_at: string | null
          activated_user_id: string | null
          created_at: string
          created_by: string | null
          email: string
          id: string
          nome: string | null
          notes: string | null
          role: Database["public"]["Enums"]["app_role"]
          status: string
          telefone: string | null
          track_location: boolean
          updated_at: string
        }
        Insert: {
          activated_at?: string | null
          activated_user_id?: string | null
          created_at?: string
          created_by?: string | null
          email: string
          id?: string
          nome?: string | null
          notes?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          telefone?: string | null
          track_location?: boolean
          updated_at?: string
        }
        Update: {
          activated_at?: string | null
          activated_user_id?: string | null
          created_at?: string
          created_by?: string | null
          email?: string
          id?: string
          nome?: string | null
          notes?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          telefone?: string | null
          track_location?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      clientes: {
        Row: {
          cep: string | null
          cidade: string | null
          codigo_externo: string | null
          cpf_cnpj: string | null
          created_at: string
          email: string | null
          empresa: string | null
          endereco: string | null
          estado: string | null
          geo_endereco: string | null
          geo_lat: number | null
          geo_lng: number | null
          id: string
          nome: string
          nome_fantasia: string | null
          observacoes: string | null
          owner_id: string
          razao_social: string | null
          source: string
          status_financeiro: string | null
          telefone: string | null
          uf: string | null
          updated_at: string
          vendedor_responsavel: string | null
        }
        Insert: {
          cep?: string | null
          cidade?: string | null
          codigo_externo?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          email?: string | null
          empresa?: string | null
          endereco?: string | null
          estado?: string | null
          geo_endereco?: string | null
          geo_lat?: number | null
          geo_lng?: number | null
          id?: string
          nome: string
          nome_fantasia?: string | null
          observacoes?: string | null
          owner_id: string
          razao_social?: string | null
          source?: string
          status_financeiro?: string | null
          telefone?: string | null
          uf?: string | null
          updated_at?: string
          vendedor_responsavel?: string | null
        }
        Update: {
          cep?: string | null
          cidade?: string | null
          codigo_externo?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          email?: string | null
          empresa?: string | null
          endereco?: string | null
          estado?: string | null
          geo_endereco?: string | null
          geo_lat?: number | null
          geo_lng?: number | null
          id?: string
          nome?: string
          nome_fantasia?: string | null
          observacoes?: string | null
          owner_id?: string
          razao_social?: string | null
          source?: string
          status_financeiro?: string | null
          telefone?: string | null
          uf?: string | null
          updated_at?: string
          vendedor_responsavel?: string | null
        }
        Relationships: []
      }
      location_pings: {
        Row: {
          created_at: string
          geo_endereco: string | null
          geo_lat: number | null
          geo_lng: number | null
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          geo_endereco?: string | null
          geo_lat?: number | null
          geo_lng?: number | null
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          geo_endereco?: string | null
          geo_lat?: number | null
          geo_lng?: number | null
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      oportunidades: {
        Row: {
          cliente_id: string | null
          created_at: string
          data_fechamento_prevista: string | null
          descricao: string | null
          estagio: Database["public"]["Enums"]["funil_estagio"]
          geo_endereco: string | null
          geo_lat: number | null
          geo_lng: number | null
          id: string
          owner_id: string
          posicao: number
          probabilidade: number
          titulo: string
          updated_at: string
          valor: number
        }
        Insert: {
          cliente_id?: string | null
          created_at?: string
          data_fechamento_prevista?: string | null
          descricao?: string | null
          estagio?: Database["public"]["Enums"]["funil_estagio"]
          geo_endereco?: string | null
          geo_lat?: number | null
          geo_lng?: number | null
          id?: string
          owner_id: string
          posicao?: number
          probabilidade?: number
          titulo: string
          updated_at?: string
          valor?: number
        }
        Update: {
          cliente_id?: string | null
          created_at?: string
          data_fechamento_prevista?: string | null
          descricao?: string | null
          estagio?: Database["public"]["Enums"]["funil_estagio"]
          geo_endereco?: string | null
          geo_lat?: number | null
          geo_lng?: number | null
          id?: string
          owner_id?: string
          posicao?: number
          probabilidade?: number
          titulo?: string
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "oportunidades_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      orcamento_itens: {
        Row: {
          created_at: string
          descricao: string
          id: string
          orcamento_id: string
          preco_unitario: number
          produto_id: string | null
          quantidade: number
          subtotal: number
        }
        Insert: {
          created_at?: string
          descricao: string
          id?: string
          orcamento_id: string
          preco_unitario?: number
          produto_id?: string | null
          quantidade?: number
          subtotal?: number
        }
        Update: {
          created_at?: string
          descricao?: string
          id?: string
          orcamento_id?: string
          preco_unitario?: number
          produto_id?: string | null
          quantidade?: number
          subtotal?: number
        }
        Relationships: [
          {
            foreignKeyName: "orcamento_itens_orcamento_id_fkey"
            columns: ["orcamento_id"]
            isOneToOne: false
            referencedRelation: "orcamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamento_itens_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      orcamentos: {
        Row: {
          cliente_id: string
          codigo_externo: string | null
          created_at: string
          data_documento: string | null
          data_situacao: string | null
          desconto: number
          empresa_cadastro: string | null
          finalidade: string | null
          forma_pagamento: string | null
          frete: string | null
          geo_endereco: string | null
          geo_lat: number | null
          geo_lng: number | null
          id: string
          nfe_seq: string | null
          numero: number
          observacoes: string | null
          owner_id: string
          prazo_entrega: string | null
          prioridade: string | null
          responsavel_documento: string | null
          source: string
          status: Database["public"]["Enums"]["orcamento_status"]
          status_externo: string | null
          total: number
          updated_at: string
          validade: string | null
        }
        Insert: {
          cliente_id: string
          codigo_externo?: string | null
          created_at?: string
          data_documento?: string | null
          data_situacao?: string | null
          desconto?: number
          empresa_cadastro?: string | null
          finalidade?: string | null
          forma_pagamento?: string | null
          frete?: string | null
          geo_endereco?: string | null
          geo_lat?: number | null
          geo_lng?: number | null
          id?: string
          nfe_seq?: string | null
          numero?: number
          observacoes?: string | null
          owner_id: string
          prazo_entrega?: string | null
          prioridade?: string | null
          responsavel_documento?: string | null
          source?: string
          status?: Database["public"]["Enums"]["orcamento_status"]
          status_externo?: string | null
          total?: number
          updated_at?: string
          validade?: string | null
        }
        Update: {
          cliente_id?: string
          codigo_externo?: string | null
          created_at?: string
          data_documento?: string | null
          data_situacao?: string | null
          desconto?: number
          empresa_cadastro?: string | null
          finalidade?: string | null
          forma_pagamento?: string | null
          frete?: string | null
          geo_endereco?: string | null
          geo_lat?: number | null
          geo_lng?: number | null
          id?: string
          nfe_seq?: string | null
          numero?: number
          observacoes?: string | null
          owner_id?: string
          prazo_entrega?: string | null
          prioridade?: string | null
          responsavel_documento?: string | null
          source?: string
          status?: Database["public"]["Enums"]["orcamento_status"]
          status_externo?: string | null
          total?: number
          updated_at?: string
          validade?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orcamentos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      pedido_itens: {
        Row: {
          created_at: string
          descricao: string
          id: string
          pedido_id: string
          preco_unitario: number
          produto_id: string | null
          quantidade: number
          subtotal: number
        }
        Insert: {
          created_at?: string
          descricao: string
          id?: string
          pedido_id: string
          preco_unitario?: number
          produto_id?: string | null
          quantidade?: number
          subtotal?: number
        }
        Update: {
          created_at?: string
          descricao?: string
          id?: string
          pedido_id?: string
          preco_unitario?: number
          produto_id?: string | null
          quantidade?: number
          subtotal?: number
        }
        Relationships: [
          {
            foreignKeyName: "pedido_itens_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_itens_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      pedidos: {
        Row: {
          cliente_id: string
          codigo_externo: string | null
          created_at: string
          data_documento: string | null
          data_situacao: string | null
          desconto: number
          empresa_cadastro: string | null
          finalidade: string | null
          forma_pagamento: string | null
          frete: string | null
          geo_endereco: string | null
          geo_lat: number | null
          geo_lng: number | null
          id: string
          nfe_seq: string | null
          numero: number
          observacoes: string | null
          orcamento_id: string | null
          owner_id: string
          prazo_entrega: string | null
          prioridade: string | null
          responsavel_documento: string | null
          source: string
          status: Database["public"]["Enums"]["pedido_status"]
          status_externo: string | null
          total: number
          updated_at: string
        }
        Insert: {
          cliente_id: string
          codigo_externo?: string | null
          created_at?: string
          data_documento?: string | null
          data_situacao?: string | null
          desconto?: number
          empresa_cadastro?: string | null
          finalidade?: string | null
          forma_pagamento?: string | null
          frete?: string | null
          geo_endereco?: string | null
          geo_lat?: number | null
          geo_lng?: number | null
          id?: string
          nfe_seq?: string | null
          numero?: number
          observacoes?: string | null
          orcamento_id?: string | null
          owner_id: string
          prazo_entrega?: string | null
          prioridade?: string | null
          responsavel_documento?: string | null
          source?: string
          status?: Database["public"]["Enums"]["pedido_status"]
          status_externo?: string | null
          total?: number
          updated_at?: string
        }
        Update: {
          cliente_id?: string
          codigo_externo?: string | null
          created_at?: string
          data_documento?: string | null
          data_situacao?: string | null
          desconto?: number
          empresa_cadastro?: string | null
          finalidade?: string | null
          forma_pagamento?: string | null
          frete?: string | null
          geo_endereco?: string | null
          geo_lat?: number | null
          geo_lng?: number | null
          id?: string
          nfe_seq?: string | null
          numero?: number
          observacoes?: string | null
          orcamento_id?: string | null
          owner_id?: string
          prazo_entrega?: string | null
          prioridade?: string | null
          responsavel_documento?: string | null
          source?: string
          status?: Database["public"]["Enums"]["pedido_status"]
          status_externo?: string | null
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pedidos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_orcamento_id_fkey"
            columns: ["orcamento_id"]
            isOneToOne: false
            referencedRelation: "orcamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      produtos: {
        Row: {
          ativo: boolean
          categoria: string | null
          codigo_externo: string | null
          created_at: string
          descricao: string | null
          disponivel: number | null
          estoque: number
          id: string
          nome: string
          owner_id: string
          preco: number
          preco_sugerido: number | null
          sku: string | null
          source: string
          unidade: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          categoria?: string | null
          codigo_externo?: string | null
          created_at?: string
          descricao?: string | null
          disponivel?: number | null
          estoque?: number
          id?: string
          nome: string
          owner_id: string
          preco?: number
          preco_sugerido?: number | null
          sku?: string | null
          source?: string
          unidade?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          categoria?: string | null
          codigo_externo?: string | null
          created_at?: string
          descricao?: string | null
          disponivel?: number | null
          estoque?: number
          id?: string
          nome?: string
          owner_id?: string
          preco?: number
          preco_sugerido?: number | null
          sku?: string | null
          source?: string
          unidade?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          id: string
          nome: string
          telefone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          nome: string
          telefone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          nome?: string
          telefone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      find_user_by_name: { Args: { _nome: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_current_user_authorized: { Args: never; Returns: boolean }
      unaccent_safe: { Args: { _t: string }; Returns: string }
    }
    Enums: {
      app_role: "admin" | "vendedor"
      funil_estagio:
        | "lead"
        | "qualificado"
        | "proposta"
        | "negociacao"
        | "ganho"
        | "perdido"
      orcamento_status:
        | "rascunho"
        | "enviado"
        | "aprovado"
        | "rejeitado"
        | "expirado"
      pedido_status:
        | "novo"
        | "confirmado"
        | "em_separacao"
        | "faturado"
        | "enviado"
        | "entregue"
        | "cancelado"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "vendedor"],
      funil_estagio: [
        "lead",
        "qualificado",
        "proposta",
        "negociacao",
        "ganho",
        "perdido",
      ],
      orcamento_status: [
        "rascunho",
        "enviado",
        "aprovado",
        "rejeitado",
        "expirado",
      ],
      pedido_status: [
        "novo",
        "confirmado",
        "em_separacao",
        "faturado",
        "enviado",
        "entregue",
        "cancelado",
      ],
    },
  },
} as const
