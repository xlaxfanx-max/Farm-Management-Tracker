import React from 'react';
import { Plus } from 'lucide-react';

function Dashboard({ applications, onViewApp, onNewApp }) {

  if (!applications || !Array.isArray(applications)) {
    applications = [];
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-6 text-white">
          <div className="text-3xl font-bold mb-2">{applications.length}</div>
          <p className="text-blue-100">Total Applications</p>
        </div>
        
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg p-6 text-white">
          <div className="text-3xl font-bold mb-2">
            {applications.filter(a => a.status === 'complete').length}
          </div>
          <p className="text-green-100">Complete</p>
        </div>
        
        <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-lg p-6 text-white">
          <div className="text-3xl font-bold mb-2">
            {applications.filter(a => a.status === 'pending_signature').length}
          </div>
          <p className="text-amber-100">Pending</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Applications</h2>
          <button 
            onClick={onNewApp}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            <Plus size={20} />
            New Application
          </button>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="text-left p-3 text-sm font-semibold">Date</th>
                <th className="text-left p-3 text-sm font-semibold">Field</th>
                <th className="text-left p-3 text-sm font-semibold">Product</th>
                <th className="text-left p-3 text-sm font-semibold">Amount</th>
                <th className="text-left p-3 text-sm font-semibold">Applicator</th>
                <th className="text-left p-3 text-sm font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {applications.map(app => (
                <tr 
                  key={app.id} 
                  onClick={() => onViewApp(app)}
                  className="border-b hover:bg-blue-50 cursor-pointer"
                >
                  <td className="p-3 text-sm">{app.application_date}</td>
                  <td className="p-3 text-sm">{app.field_name}</td>
                  <td className="p-3 text-sm">{app.product_name}</td>
                  <td className="p-3 text-sm">{app.amount_used} {app.unit_of_measure}</td>
                  <td className="p-3 text-sm">{app.applicator_name}</td>
                  <td className="p-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      app.status === 'complete' ? 'bg-green-100 text-green-700' : 
                      app.status === 'submitted' ? 'bg-blue-100 text-blue-700' :
                      'bg-amber-100 text-amber-700'
                    }`}>
                      {app.status === 'complete' ? 'Complete' : 
                       app.status === 'submitted' ? 'Submitted' : 
                       'Pending'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;