class ProjectsController < ApplicationController
  before_action :set_project, only: [:show, :update, :destroy, :search, :check_in, :move_many]
  before_action :validate_user_approved, only: [:create]

  before_action only: [:update, :destroy] do
    validate_user_admin(@project)
  end

  # GET /projects
  def index
    # @projects = Project.all.order(updated_at: :desc)
    if user_signed_in? && current_user.approved?
      if current_user.admin
        @projects = Project.all
      else
        @projects = Project.is_public | current_user.readable_projects
      end
    else
      @projects = Project.is_public
    end

    render json: @projects
  end

  # GET /projects/1
  def show
    if validate_user_read(@project,true)
      render json: @project, include: ['user_project_permissions', 'user_project_permissions.user', 'contents_children', 'can_admin'], scope_name: :current_user
    else
      render json: { forbidden: true }
    end
  end

  # POST /projects
  def create
    @project = Project.new(project_params)
    @project.owner = current_user

    if @project.save
      UserProjectPermission.create(project: @project, user: current_user, permission: 'admin')
      render json: @project, include: ['user_project_permissions', 'user_project_permissions.user', 'contents_children', 'can_admin'], status: :created, location: @project
    else
      render json: @project.errors, status: :unprocessable_entity
    end
  end

  # PATCH/PUT /projects/1
  def update
    if @project.update(project_params)
      render json: @project, include: ['user_project_permissions', 'user_project_permissions.user', 'contents_children', 'can_admin']
    else
      render json: @project.errors, status: :unprocessable_entity
    end
  end

  # DELETE /projects/1
  def destroy
    @project.destroy
  end

  # GET /projects/1/search?search_phrase
  def search
    documents = Document.where( project_id: params['id'] )
    results = documents.search_for( params['q'] ).limit(100)
    render json: results.map { |result| result.to_obj }
  end

  # GET /projects/1/check_in
  def check_in
    checked_in_doc_ids = @project.check_in_all(current_user)
    render json: { checked_in_docs: checked_in_doc_ids }
  end

  # PATCH /projects/1/move_many
  def move_many
    @document_ids = params[:document_ids]
    Document.where(id: @document_ids).sort_by(&:title).reverse!.each {|doc|
      doc.move_to(0, params[:id], 'Project')
    }
    render json: @project, status: 200
  end

  private
    # Use callbacks to share common setup or constraints between actions.
    def set_project
      @project = Project.find(params[:id])
    end

    # Only allow a trusted parameter "white list" through.
    def project_params
      params.require(:project).permit(:title, :description, :public, :owner_id)
    end
end
