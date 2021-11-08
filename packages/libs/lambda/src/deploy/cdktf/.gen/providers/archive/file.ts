// https://www.terraform.io/docs/providers/archive/r/file.html
// generated from terraform resource schema

import { Construct } from "constructs";
import * as cdktf from "cdktf";

// Configuration

export interface FileConfig extends cdktf.TerraformMetaArguments {
  /**
   * Docs at Terraform Registry: {@link https://www.terraform.io/docs/providers/archive/r/file.html#excludes File#excludes}
   */
  readonly excludes?: string[];
  /**
   * Docs at Terraform Registry: {@link https://www.terraform.io/docs/providers/archive/r/file.html#output_file_mode File#output_file_mode}
   */
  readonly outputFileMode?: string;
  /**
   * Docs at Terraform Registry: {@link https://www.terraform.io/docs/providers/archive/r/file.html#output_path File#output_path}
   */
  readonly outputPath: string;
  /**
   * Docs at Terraform Registry: {@link https://www.terraform.io/docs/providers/archive/r/file.html#source_content File#source_content}
   */
  readonly sourceContent?: string;
  /**
   * Docs at Terraform Registry: {@link https://www.terraform.io/docs/providers/archive/r/file.html#source_content_filename File#source_content_filename}
   */
  readonly sourceContentFilename?: string;
  /**
   * Docs at Terraform Registry: {@link https://www.terraform.io/docs/providers/archive/r/file.html#source_dir File#source_dir}
   */
  readonly sourceDir?: string;
  /**
   * Docs at Terraform Registry: {@link https://www.terraform.io/docs/providers/archive/r/file.html#source_file File#source_file}
   */
  readonly sourceFile?: string;
  /**
   * Docs at Terraform Registry: {@link https://www.terraform.io/docs/providers/archive/r/file.html#type File#type}
   */
  readonly type: string;
  /**
   * source block
   *
   * Docs at Terraform Registry: {@link https://www.terraform.io/docs/providers/archive/r/file.html#source File#source}
   */
  readonly source?: FileSource[];
}
export interface FileSource {
  /**
   * Docs at Terraform Registry: {@link https://www.terraform.io/docs/providers/archive/r/file.html#content File#content}
   */
  readonly content: string;
  /**
   * Docs at Terraform Registry: {@link https://www.terraform.io/docs/providers/archive/r/file.html#filename File#filename}
   */
  readonly filename: string;
}

function fileSourceToTerraform(struct?: FileSource): any {
  if (!cdktf.canInspect(struct)) {
    return struct;
  }
  if (cdktf.isComplexElement(struct)) {
    throw new Error(
      "A complex element was used as configuration, this is not supported: https://cdk.tf/complex-object-as-configuration"
    );
  }
  return {
    content: cdktf.stringToTerraform(struct!.content),
    filename: cdktf.stringToTerraform(struct!.filename)
  };
}

/**
 * Represents a {@link https://www.terraform.io/docs/providers/archive/r/file.html archive_file}
 */
export class File extends cdktf.TerraformResource {
  // =================
  // STATIC PROPERTIES
  // =================
  public static readonly tfResourceType: string = "archive_file";

  // ===========
  // INITIALIZER
  // ===========

  /**
   * Create a new {@link https://www.terraform.io/docs/providers/archive/r/file.html archive_file} Resource
   *
   * @param scope The scope in which to define this construct
   * @param id The scoped construct ID. Must be unique amongst siblings in the same scope
   * @param options FileConfig
   */
  public constructor(scope: Construct, id: string, config: FileConfig) {
    super(scope, id, {
      terraformResourceType: "archive_file",
      terraformGeneratorMetadata: {
        providerName: "archive"
      },
      provider: config.provider,
      dependsOn: config.dependsOn,
      count: config.count,
      lifecycle: config.lifecycle
    });
    this._excludes = config.excludes;
    this._outputFileMode = config.outputFileMode;
    this._outputPath = config.outputPath;
    this._sourceContent = config.sourceContent;
    this._sourceContentFilename = config.sourceContentFilename;
    this._sourceDir = config.sourceDir;
    this._sourceFile = config.sourceFile;
    this._type = config.type;
    this._source = config.source;
  }

  // ==========
  // ATTRIBUTES
  // ==========

  // excludes - computed: false, optional: true, required: false
  private _excludes?: string[] | undefined;
  public get excludes() {
    return this.getListAttribute("excludes");
  }
  public set excludes(value: string[] | undefined) {
    this._excludes = value;
  }
  public resetExcludes() {
    this._excludes = undefined;
  }
  // Temporarily expose input value. Use with caution.
  public get excludesInput() {
    return this._excludes;
  }

  // id - computed: true, optional: true, required: false
  public get id() {
    return this.getStringAttribute("id");
  }

  // output_base64sha256 - computed: true, optional: false, required: false
  public get outputBase64Sha256() {
    return this.getStringAttribute("output_base64sha256");
  }

  // output_file_mode - computed: false, optional: true, required: false
  private _outputFileMode?: string | undefined;
  public get outputFileMode() {
    return this.getStringAttribute("output_file_mode");
  }
  public set outputFileMode(value: string | undefined) {
    this._outputFileMode = value;
  }
  public resetOutputFileMode() {
    this._outputFileMode = undefined;
  }
  // Temporarily expose input value. Use with caution.
  public get outputFileModeInput() {
    return this._outputFileMode;
  }

  // output_md5 - computed: true, optional: false, required: false
  public get outputMd5() {
    return this.getStringAttribute("output_md5");
  }

  // output_path - computed: false, optional: false, required: true
  private _outputPath?: string;
  public get outputPath() {
    return this.getStringAttribute("output_path");
  }
  public set outputPath(value: string) {
    this._outputPath = value;
  }
  // Temporarily expose input value. Use with caution.
  public get outputPathInput() {
    return this._outputPath;
  }

  // output_sha - computed: true, optional: false, required: false
  public get outputSha() {
    return this.getStringAttribute("output_sha");
  }

  // output_size - computed: true, optional: false, required: false
  public get outputSize() {
    return this.getNumberAttribute("output_size");
  }

  // source_content - computed: false, optional: true, required: false
  private _sourceContent?: string | undefined;
  public get sourceContent() {
    return this.getStringAttribute("source_content");
  }
  public set sourceContent(value: string | undefined) {
    this._sourceContent = value;
  }
  public resetSourceContent() {
    this._sourceContent = undefined;
  }
  // Temporarily expose input value. Use with caution.
  public get sourceContentInput() {
    return this._sourceContent;
  }

  // source_content_filename - computed: false, optional: true, required: false
  private _sourceContentFilename?: string | undefined;
  public get sourceContentFilename() {
    return this.getStringAttribute("source_content_filename");
  }
  public set sourceContentFilename(value: string | undefined) {
    this._sourceContentFilename = value;
  }
  public resetSourceContentFilename() {
    this._sourceContentFilename = undefined;
  }
  // Temporarily expose input value. Use with caution.
  public get sourceContentFilenameInput() {
    return this._sourceContentFilename;
  }

  // source_dir - computed: false, optional: true, required: false
  private _sourceDir?: string | undefined;
  public get sourceDir() {
    return this.getStringAttribute("source_dir");
  }
  public set sourceDir(value: string | undefined) {
    this._sourceDir = value;
  }
  public resetSourceDir() {
    this._sourceDir = undefined;
  }
  // Temporarily expose input value. Use with caution.
  public get sourceDirInput() {
    return this._sourceDir;
  }

  // source_file - computed: false, optional: true, required: false
  private _sourceFile?: string | undefined;
  public get sourceFile() {
    return this.getStringAttribute("source_file");
  }
  public set sourceFile(value: string | undefined) {
    this._sourceFile = value;
  }
  public resetSourceFile() {
    this._sourceFile = undefined;
  }
  // Temporarily expose input value. Use with caution.
  public get sourceFileInput() {
    return this._sourceFile;
  }

  // type - computed: false, optional: false, required: true
  private _type?: string;
  public get type() {
    return this.getStringAttribute("type");
  }
  public set type(value: string) {
    this._type = value;
  }
  // Temporarily expose input value. Use with caution.
  public get typeInput() {
    return this._type;
  }

  // source - computed: false, optional: true, required: false
  private _source?: FileSource[] | undefined;
  public get source() {
    // Getting the computed value is not yet implemented
    return this.interpolationForAttribute("source") as any;
  }
  public set source(value: FileSource[] | undefined) {
    this._source = value;
  }
  public resetSource() {
    this._source = undefined;
  }
  // Temporarily expose input value. Use with caution.
  public get sourceInput() {
    return this._source;
  }

  // =========
  // SYNTHESIS
  // =========

  protected synthesizeAttributes(): { [name: string]: any } {
    return {
      excludes: cdktf.listMapper(cdktf.stringToTerraform)(this._excludes),
      output_file_mode: cdktf.stringToTerraform(this._outputFileMode),
      output_path: cdktf.stringToTerraform(this._outputPath),
      source_content: cdktf.stringToTerraform(this._sourceContent),
      source_content_filename: cdktf.stringToTerraform(
        this._sourceContentFilename
      ),
      source_dir: cdktf.stringToTerraform(this._sourceDir),
      source_file: cdktf.stringToTerraform(this._sourceFile),
      type: cdktf.stringToTerraform(this._type),
      source: cdktf.listMapper(fileSourceToTerraform)(this._source)
    };
  }
}
