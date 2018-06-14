Rails.application.routes.draw do
  resources :document_folders
  resources :documents
  resources :links
  resources :highlights
  resources :projects
  mount_devise_token_auth_for 'User', at: 'auth'

  post '/highlights/duplicate' => 'highlights#duplicate'
  post '/highlights/:id/set_thumbnail' => 'highlights#set_thumbnail'
  post '/documents/:id/set_thumbnail' => 'documents#set_thumbnail'
  put '/documents/:id/add_images' => 'documents#add_images'

  get '*path', to: "application#fallback_index_html", constraints: ->(request) do
    !request.xhr? && request.format.html?
  end
  # For details on the DSL available within this file, see http://guides.rubyonrails.org/routing.html
end
