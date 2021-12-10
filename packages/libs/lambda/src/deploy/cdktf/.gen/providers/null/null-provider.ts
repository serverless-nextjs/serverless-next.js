// https://www.terraform.io/docs/providers/null
// generated from terraform resource schema

import { Construct } from "constructs";
import * as cdktf from "cdktf";

// Configuration

export interface NullProviderConfig {
  /**
   * Alias name
   *
   * Docs at Terraform Registry: {@link https://www.terraform.io/docs/providers/null#alias NullProvider#alias}
   */
  readonly alias?: string;
}

/**
 * Represents a {@link https://www.terraform.io/docs/providers/null null}
 */
export class NullProvider extends cdktf.TerraformProvider {
  // =================
  // STATIC PROPERTIES
  // =================
  public static readonly tfResourceType: string = "null";

  // ===========
  // INITIALIZER
  // ===========

  /**
   * Create a new {@link https://www.terraform.io/docs/providers/null null} Resource
   *
   * @param scope The scope in which to define this construct
   * @param id The scoped construct ID. Must be unique amongst siblings in the same scope
   * @param options NullProviderConfig = {}
   */
  public constructor(
    scope: Construct,
    id: string,
    config: NullProviderConfig = {}
  ) {
    super(scope, id, {
      terraformResourceType: "null",
      terraformGeneratorMetadata: {
        providerName: "null",
        providerVersionConstraint: "~> 3.1.0"
      },
      terraformProviderSource: "hashicorp/null"
    });
    this._alias = config.alias;
  }

  // ==========
  // ATTRIBUTES
  // ==========

  // alias - computed: false, optional: true, required: false
  private _alias?: string | undefined;
  public get alias() {
    return this._alias;
  }
  public set alias(value: string | undefined | undefined) {
    this._alias = value;
  }
  public resetAlias() {
    this._alias = undefined;
  }
  // Temporarily expose input value. Use with caution.
  public get aliasInput() {
    return this._alias;
  }

  // =========
  // SYNTHESIS
  // =========

  protected synthesizeAttributes(): { [name: string]: any } {
    return {
      alias: cdktf.stringToTerraform(this._alias)
    };
  }
}
