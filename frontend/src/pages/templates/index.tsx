import { useEffect, useState } from 'react';
import { Table, Card, Button, Space, Tag, Popconfirm, message } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, CopyOutlined } from '@ant-design/icons';
import { api } from '../../api';
import type { RuleTemplate } from '../../types';
import { useNavigate } from 'react-router-dom';

const TemplatesManage: React.FC = () => {
  const [templates, setTemplates] = useState<RuleTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const data = await api.getTemplates();
      setTemplates(data);
    } catch (e) {
      message.error('获取模板失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const handleDelete = async (id: string) => {
    try {
      await api.deleteTemplate(id);
      message.success('删除成功');
      setTemplates(templates.filter(t => t.id !== id));
    } catch (e) {
      message.error('删除失败');
    }
  };

  const columns = [
    {
      title: '模板名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: RuleTemplate) => (
        <Space>
          <span style={{ fontWeight: 500 }}>{text}</span>
          {record.isDefault && <Tag color="blue">默认</Tag>}
        </Space>
      )
    },
    {
      title: '说明',
      dataIndex: 'description',
      key: 'description',
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: RuleTemplate) => (
        <Space size="middle">
          <Button type="link" size="small" onClick={() => navigate('/check')}>应用</Button>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => navigate('/rules')}>编辑</Button>
          <Button type="link" size="small" icon={<CopyOutlined />} onClick={() => message.success('复制成功')}>复制</Button>
          {!record.isDefault && (
            <Popconfirm title="确定要删除这个模板吗？" onConfirm={() => handleDelete(record.id)}>
              <Button type="link" danger size="small" icon={<DeleteOutlined />}>删除</Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card 
        bordered={false} 
        title={<span style={{ fontSize: 20 }}>模板管理</span>}
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/rules')}>
            新建模板
          </Button>
        }
      >
        <Table 
          columns={columns} 
          dataSource={templates} 
          rowKey="id" 
          loading={loading}
          pagination={false}
        />
      </Card>
    </div>
  );
};

export default TemplatesManage;
