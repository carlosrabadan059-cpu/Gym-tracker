import { Users } from 'lucide-react';
import { ClientsListView } from '../../views/trainer/ClientsListView';
import { ClientProfileView } from '../../views/trainer/ClientProfileView';

// Fase 0.4: clientes maestro-detalle. En md: la lista (columna estrecha) y el
// perfil del cliente seleccionado se ven a la vez. Por debajo de md: una cosa
// cada vez — la lista, y al tocar un cliente su perfil (view cambia a
// trainer_client_profile).

export function TrainerClientsView({
    view,
    client,
    onSelectClient,
    onOpenProfile,
    onBackToList,
    onBackToDashboard,
    onAssignRoutine,
}) {
    const showingList = view === 'trainer_clients';

    return (
        <div className="md:flex md:items-start md:gap-6">
            <div className={`md:w-72 md:flex-shrink-0 ${showingList ? '' : 'hidden md:block'}`}>
                <ClientsListView
                    embedded
                    selectedId={client?.user_id}
                    onBack={onBackToDashboard}
                    onSelectClient={(c) => {
                        onSelectClient(c);
                        onOpenProfile();
                    }}
                />
            </div>

            <div className={`min-w-0 flex-1 ${showingList ? 'hidden md:block' : ''}`}>
                {client ? (
                    <ClientProfileView
                        key={client.user_id}
                        embedded
                        client={client}
                        onBack={onBackToList}
                        onAssignRoutine={onAssignRoutine}
                    />
                ) : (
                    <div className="hidden flex-col items-center justify-center py-24 text-text-secondary md:flex">
                        <Users size={40} className="mb-3 opacity-40" />
                        <p className="text-sm">Selecciona un cliente para ver su perfil</p>
                    </div>
                )}
            </div>
        </div>
    );
}
